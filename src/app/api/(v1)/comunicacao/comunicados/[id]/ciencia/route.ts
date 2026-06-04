import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { unauthorizedError, handleRouteError } from "@/lib/errors";
import { confirmarLeitura } from "@/application/comunicacao/use-cases/confirmar-leitura";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getAuthSession(req);
    if (!session) return unauthorizedError();

    const { id } = await ctx.params;
    const result = await confirmarLeitura(session.condominioId, id, session.userId);

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
