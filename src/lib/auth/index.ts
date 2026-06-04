import NextAuth from "next-auth";
import type { NextAuthConfig, User as NextAuthUser } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/client";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { verifyPassword } from "@/lib/auth/password";

// Augment NextAuth session with tenant + perfil claims per ARD §3.4 / CODAA-53
declare module "next-auth" {
  interface Session {
    condominioId: string;
    perfil: PerfilUsuario;
    vinculoId?: string | undefined;
    // Q3 (multi-vínculo): full list populated once seletor-de-condominio is built
    vinculos?: Array<{ condominioId: string; perfil: PerfilUsuario; vinculoId: string }>;
  }

  interface User {
    condominioId?: string | undefined;
    perfil?: PerfilUsuario | undefined;
    vinculoId?: string | undefined;
  }
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const config: NextAuthConfig = {
  providers: [
    Credentials({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            vinculos: {
              where: { ativo: true },
              orderBy: { criadoEm: "asc" },
            },
          },
        });

        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // Q2: single-vínculo path — pick the first active vínculo.
        // Q3 (multi-vínculo): the FE seletor will POST /api/v1/auth/select-condominio
        // to swap the active condominioId; a new JWT will be issued at that point.
        const vinculo = user.vinculos[0];
        if (!vinculo) return null;

        return {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          condominioId: vinculo.condominioId,
          perfil: vinculo.perfil,
          vinculoId: vinculo.id,
        } as NextAuthUser;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        if (user.condominioId !== undefined) {
          token["condominioId"] = user.condominioId;
        }
        if (user.perfil !== undefined) {
          token["perfil"] = user.perfil;
        }
        if (user.vinculoId !== undefined) {
          token["vinculoId"] = user.vinculoId;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token["condominioId"] === "string") {
        session.condominioId = token["condominioId"];
      }
      const perfil = token["perfil"];
      if (
        typeof perfil === "string" &&
        Object.values(PerfilUsuario).includes(perfil as PerfilUsuario)
      ) {
        session.perfil = perfil as PerfilUsuario;
      }
      if (typeof token["vinculoId"] === "string") {
        session.vinculoId = token["vinculoId"];
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    // Default: 30 days; can be overridden per environment
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    // FE should redirect to /login on 401; no server-side redirect from API routes
    signIn: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
