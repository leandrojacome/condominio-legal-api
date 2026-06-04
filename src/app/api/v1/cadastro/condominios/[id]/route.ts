import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AtualizarCondominioSchema } from "@/domain/cadastro/schemas";
import {
  validationError,
  notFoundError,
  forbiddenError,
  handleRouteError,
} from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { stripUndefined } from "@/lib/utils";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext();

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const condominio = await db.condominio.findFirst({ where: { id } });

    if (!condominio) {
      return notFoundError("Condominio") as unknown as Response;
    }

    return NextResponse.json(condominio);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const PATCH = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext();

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AtualizarCondominioSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const condominio = await db.condominio.update({
      where: { id },
      data: stripUndefined(parsed.data),
    });

    return NextResponse.json(condominio);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
