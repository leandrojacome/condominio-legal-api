import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { calcularEncargos } from "@/domain/financeiro/inadimplencia";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const condominio = await db.condominio.findFirst({ where: { id: condominioId } });

    const cobrancasAtrasadas = await db.cobranca.findMany({
      where: { status: "em_atraso" },
      include: { unidade: { include: { vinculos: { include: { pessoa: true } } } } },
      orderBy: { vencimento: "asc" },
    });

    const inadimplentes = cobrancasAtrasadas.map((c) => {
      const encargos = condominio
        ? calcularEncargos({
            valorPrincipal: c.valor,
            vencimento: c.vencimento,
            dataReferencia: new Date(),
            multaPercentual: condominio.multaAtraso,
            jurosMensalPercentual: condominio.jurosMensal,
          })
        : null;
      return { cobranca: c, encargos };
    });

    return NextResponse.json({ data: inadimplentes, total: inadimplentes.length });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
