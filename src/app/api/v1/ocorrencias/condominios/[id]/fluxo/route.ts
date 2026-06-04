import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { ConfigurarFluxoSchema } from "@/domain/ocorrencias/schemas";
import { configurarFluxo, obterFluxo } from "@/application/ocorrencias/use-cases/configurar-fluxo";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext(req);
    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const fluxo = await obterFluxo(tenantCtx.condominioId);
    return NextResponse.json({ data: fluxo });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const PUT = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext(req);
    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = ConfigurarFluxoSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const result = await configurarFluxo(tenantCtx.condominioId, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
