/**
 * Supabase Auth integration (CODAA-70).
 *
 * The FE signs in via Supabase Auth and passes the access_token as
 * `Authorization: Bearer <token>` on every API request.
 *
 * The backend validates the token with supabase.auth.getUser(token),
 * then derives the tenant context (condominioId, perfil, vinculoId)
 * from the User's active Vínculo in our database.
 *
 * Shape of the Supabase access_token JWT (Q2 resolved — CODAA-70):
 * {
 *   iss: "https://<project>.supabase.co/auth/v1",
 *   sub: "<supabase-user-uuid>",
 *   aud: "authenticated",
 *   email: "user@example.com",
 *   role: "authenticated",
 *   app_metadata: { provider: "email", providers: ["email"] },
 *   user_metadata: {},
 *   exp: <unix-ts>,
 *   iat: <unix-ts>,
 * }
 *
 * The backend does NOT rely on JWT claims for condominioId/perfil/vinculoId —
 * it always derives those from the DB using the verified user's email.
 * This approach avoids stale claims and doesn't require custom JWT hooks.
 */

import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { prisma } from "@/infrastructure/db/client";
import { PerfilUsuario } from "@/domain/cadastro/perfil";

export interface AuthSession {
  /** Internal User.id (cuid) */
  userId: string;
  /** Supabase Auth user UUID */
  supabaseId: string;
  email: string;
  name: string | null;
  condominioId: string;
  perfil: PerfilUsuario;
  vinculoId: string;
}

/**
 * Validates the Supabase access token from the Authorization header and
 * returns the session context, or null when unauthenticated / invalid.
 *
 * Usage: const session = await getAuthSession(req);
 */
export async function getAuthSession(req: NextRequest): Promise<AuthSession | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // Validate with Supabase — confirms signature + expiry
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;

  const supabaseUser = data.user;
  const email = supabaseUser.email;
  if (!email) return null;

  // Derive tenant context from DB
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      vinculos: {
        where: { ativo: true },
        orderBy: { criadoEm: "asc" },
      },
    },
  });

  if (!user) return null;

  // Single-vínculo path (Q3: multi-vínculo selector deferred)
  const vinculo = user.vinculos[0];
  if (!vinculo) return null;

  return {
    userId: user.id,
    supabaseId: supabaseUser.id,
    email,
    name: user.name ?? null,
    condominioId: vinculo.condominioId,
    perfil: vinculo.perfil as PerfilUsuario,
    vinculoId: vinculo.id,
  };
}

// Re-export PerfilUsuario for convenience
export { PerfilUsuario };
