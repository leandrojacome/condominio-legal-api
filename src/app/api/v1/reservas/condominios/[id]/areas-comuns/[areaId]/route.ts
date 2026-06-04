import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AtualizarAreaComumSchema } from "@/domain/reservas/schemas";
import { validationError, forbiddenError, notFoundError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { atualizarAreaComum } from "@/application/reservas/use-cases/atualizar-area-comum";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const id = params["id"] as string;
    const areaId = params["areaId"] as string;
    const tenantCtx = await getTenantContext();

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const area = await db.areaComum.findFirst({ where: { id: areaId } });

    if (!area) {
      return notFoundError("Área comum") as unknown as Response;
    }

    return NextResponse.json(area);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const PATCH = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const id = params["id"] as string;
    const areaId = params["areaId"] as string;
    const tenantCtx = await getTenantContext();

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AtualizarAreaComumSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const area = await atualizarAreaComum(tenantCtx.condominioId, areaId, parsed.data);
    return NextResponse.json(area);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
