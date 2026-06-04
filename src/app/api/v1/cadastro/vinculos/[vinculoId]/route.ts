import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { notFoundError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const DELETE = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const vinculoId = (await ctx.params)["vinculoId"] as string;
    const tenantCtx = await getTenantContext();
    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const vinculo = await db.vinculo.findFirst({ where: { id: vinculoId } });
    if (!vinculo) return notFoundError("Vinculo") as unknown as Response;

    if (vinculo.condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    await db.vinculo.delete({ where: { id: vinculoId } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
