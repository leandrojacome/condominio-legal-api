import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { RegistrarEncomendaSchema, ConsultarHistoricoQuerySchema } from "@/domain/portaria/schemas";
import { registrarEncomenda } from "@/application/portaria/use-cases/registrar-encomenda";
import { consultarHistoricoEncomendas } from "@/application/portaria/use-cases/consultar-historico";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import type { RouteContext } from "@/lib/auth/rbac";
import { getRequiredIdempotencyKey, idempotencyHeaders, withIdempotencyRecord } from "@/lib/idempotency";

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
    const tenantCtx = await getTenantContext(req);

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

    const page = await consultarHistoricoEncomendas(tenantCtx.condominioId, queryParsed.data);
    return NextResponse.json(page);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const POST = requirePerfil(
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const idempotencyKey = getRequiredIdempotencyKey(req);
    const tenantCtx = await getTenantContext(req);

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = RegistrarEncomendaSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    return await withIdempotencyRecord({
      condominioId: tenantCtx.condominioId,
      operationScope: "portaria.encomendas.create",
      idempotencyKey,
      requestPayload: { condominioId: tenantCtx.condominioId, body: parsed.data },
    }, async () => {
      const encomenda = await registrarEncomenda(
        tenantCtx.condominioId,
        tenantCtx.userId,
        parsed.data
      );
      return NextResponse.json(encomenda, {
        status: 201,
        headers: idempotencyHeaders(idempotencyKey),
      });
    });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
