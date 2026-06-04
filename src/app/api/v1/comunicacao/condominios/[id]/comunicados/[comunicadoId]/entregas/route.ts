import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { forbiddenError, handleRouteError } from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const comunicadoId = params["comunicadoId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const { cursor, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const lim = limit ?? 20;

    const items = await db.entregaComunicado.findMany({
      where: {
        comunicadoId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      take: lim + 1,
      orderBy: { criadoEm: "asc" },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
