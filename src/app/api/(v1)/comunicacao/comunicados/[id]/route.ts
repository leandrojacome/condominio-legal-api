import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { unauthorizedError, handleRouteError } from "@/lib/errors";
import { obterComunicado } from "@/application/comunicacao/use-cases/obter-comunicado";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getAuthSession(req);
    if (!session) return unauthorizedError();

    const { id } = await ctx.params;
    const comunicado = await obterComunicado(session.condominioId, id, session.userId);

    return NextResponse.json(comunicado);
  } catch (err) {
    return handleRouteError(err);
  }
}
