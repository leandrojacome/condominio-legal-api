import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { notFoundError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO, PerfilUsuario.PORTEIRO, PerfilUsuario.CONSELHO
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
    const comunicado = await db.comunicado.findFirst({
      where: { id: comunicadoId },
      include: { _count: { select: { entregas: true } } },
    });
    if (!comunicado) return notFoundError("Comunicado") as unknown as Response;

    return NextResponse.json(comunicado);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
