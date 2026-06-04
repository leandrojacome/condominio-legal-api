import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorizedError, handleRouteError } from "@/lib/errors";
import { obterComunicado } from "@/application/comunicacao/use-cases/obter-comunicado";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/comunicacao/comunicados/[id]
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorizedError();

    const { id } = await ctx.params;

    const comunicado = await obterComunicado(session.condominioId, id, session.user.id);

    return NextResponse.json(comunicado);
  } catch (err) {
    return handleRouteError(err);
  }
}
