import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PerfilUsuario } from "@/domain/cadastro/perfil";

// Augment NextAuth session with tenant + perfil claims per ARD §3.4
declare module "next-auth" {
  interface Session {
    condominioId: string;
    perfil: PerfilUsuario;
    vinculoId?: string | undefined;
  }

  interface User {
    condominioId?: string | undefined;
    perfil?: PerfilUsuario | undefined;
    vinculoId?: string | undefined;
  }
}

const config: NextAuthConfig = {
  providers: [
    // Providers will be configured per authentication module.
    // Placeholder for dev/test — credentials or magic-link added in auth module.
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
      if (typeof perfil === "string" && Object.values(PerfilUsuario).includes(perfil as PerfilUsuario)) {
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
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
