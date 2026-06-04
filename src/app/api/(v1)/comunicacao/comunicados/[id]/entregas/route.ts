import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { unauthorizedError, handleRouteError } from "@/lib/errors";
import { statusEntregas } from "@/application/comunicacao/use-cases/status-entregas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getAuthSession(req);
    if (!session) return unauthorizedError();

    const { id } = await ctx.params;
    const result = await statusEntregas(session.condominioId, id, session.userId);

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
