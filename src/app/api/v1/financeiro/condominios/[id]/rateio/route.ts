import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { RatearDespesaSchema } from "@/domain/financeiro/schemas";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { ratearDespesa } from "@/application/financeiro/use-cases/ratear-despesa";
import type { RatearDespesaInput } from "@/application/financeiro/use-cases/ratear-despesa";
import type { CriterioRateio } from "@prisma/client";

export const POST = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = RatearDespesaSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const input: RatearDespesaInput = {
      condominioId,
      valor: parsed.data.valor,
      competencia: parsed.data.competencia,
      vencimento: new Date(parsed.data.vencimento),
      criterio: parsed.data.criterio as CriterioRateio,
      ...(parsed.data.descricao !== undefined ? { descricao: parsed.data.descricao } : {}),
    };

    const result = await ratearDespesa(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
