import { type NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { unauthorizedError } from "@/lib/errors";

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's session claims.
 * The FE uses this to hydrate the auth context on page load.
 *
 * 200 — session present
 * 401 — no valid Supabase token
 */
export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);

  if (!session) {
    return unauthorizedError() as unknown as Response;
  }

  return NextResponse.json({
    userId: session.userId,
    supabaseId: session.supabaseId,
    name: session.name,
    email: session.email,
    condominioId: session.condominioId,
    perfil: session.perfil,
    vinculoId: session.vinculoId,
  });
}
