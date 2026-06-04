import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { RegistrarAcessoSchema, ConsultarHistoricoQuerySchema } from "@/domain/portaria/schemas";
import { registrarAcesso } from "@/application/portaria/use-cases/registrar-acesso";
import { consultarHistoricoAcessos } from "@/application/portaria/use-cases/consultar-historico";
import {
  validationError,
  forbiddenError,
  handleRouteError,
} from "@/lib/errors";
import type { RouteContext } from "@/lib/auth/rbac";

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

    const sp = req.nextUrl.searchParams;
    const queryParsed = ConsultarHistoricoQuerySchema.safeParse({
      unidadeId: sp.get("unidadeId") ?? undefined,
      de: sp.get("de") ?? undefined,
      ate: sp.get("ate") ?? undefined,
      cursor: sp.get("cursor") ?? undefined,
      limit: sp.get("limit") ?? undefined,
    });

    if (!queryParsed.success) {
      return validationError(queryParsed.error.flatten()) as unknown as Response;
    }

    const page = await consultarHistoricoAcessos(tenantCtx.condominioId, queryParsed.data);
    return NextResponse.json(page);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const POST = requirePerfil(
  PerfilUsuario.PORTEIRO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext();

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = RegistrarAcessoSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const acesso = await registrarAcesso(tenantCtx.condominioId, tenantCtx.userId, parsed.data);
    return NextResponse.json(acesso, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
