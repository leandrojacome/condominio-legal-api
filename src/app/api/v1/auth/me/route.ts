import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorizedError } from "@/lib/errors";

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's session claims.
 * The FE uses this to hydrate the auth context on page load.
 *
 * 200 — session present
 * 401 — no valid session
 */
export async function GET() {
  const session = await auth();

  if (!session?.user || !session.condominioId || !session.perfil) {
    return unauthorizedError() as unknown as Response;
  }

  return NextResponse.json({
    userId: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    condominioId: session.condominioId,
    perfil: session.perfil,
    vinculoId: session.vinculoId ?? null,
  });
}
