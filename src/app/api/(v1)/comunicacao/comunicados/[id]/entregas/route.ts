import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorizedError, handleRouteError } from "@/lib/errors";
import { statusEntregas } from "@/application/comunicacao/use-cases/status-entregas";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/comunicacao/comunicados/[id]/entregas — delivery status (author only)
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorizedError();

    const { id } = await ctx.params;

    const result = await statusEntregas(session.condominioId, id, session.user.id);

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
