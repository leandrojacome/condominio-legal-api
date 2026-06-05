import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AtualizarCobrancaSchema } from "@/domain/financeiro/schemas";
import { validationError, notFoundError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { stripUndefined } from "@/lib/utils";
import { calcularEncargos } from "@/domain/financeiro/inadimplencia";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PROPRIETARIO, PerfilUsuario.INQUILINO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const cobrancaId = params["cobrancaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const cobranca = await db.cobranca.findFirst({
      where: { id: cobrancaId },
      include: { devedor: { include: { pessoa: true } }, emissoes: true, pagamentos: true },
    });
    if (!cobranca) return notFoundError("Cobranca") as unknown as Response;

    // Enrich with calculated encargos if em_atraso
    const condominio = await db.condominio.findFirst({ where: { id: condominioId } });
    let encargos = null;
    if (cobranca.status === "em_atraso" && condominio) {
      encargos = calcularEncargos({
        valorPrincipal: cobranca.valor,
        vencimento: cobranca.vencimento,
        dataReferencia: new Date(),
        multaPercentual: condominio.multaAtraso,
        jurosMensalPercentual: condominio.jurosMensal,
      });
    }

    return NextResponse.json({ ...cobranca, encargos });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const PATCH = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const cobrancaId = params["cobrancaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AtualizarCobrancaSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const cobranca = await db.cobranca.update({
      where: { id: cobrancaId },
      data: stripUndefined(parsed.data),
    });

    return NextResponse.json(cobranca);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
