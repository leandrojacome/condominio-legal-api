import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorizedError, handleRouteError } from "@/lib/errors";
import { confirmarLeitura } from "@/application/comunicacao/use-cases/confirmar-leitura";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/v1/comunicacao/comunicados/[id]/ciencia — confirm reading
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorizedError();

    const { id } = await ctx.params;

    const result = await confirmarLeitura(session.condominioId, id, session.user.id);

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
