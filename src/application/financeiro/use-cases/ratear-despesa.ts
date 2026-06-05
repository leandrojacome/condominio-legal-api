import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { CriterioRateio } from "@prisma/client";
import { resolverDevedorPorUnidade } from "./resolver-devedor";

export interface RatearDespesaInput {
  condominioId: string;
  valor: number;
  competencia: string;
  vencimento: Date;
  criterio: CriterioRateio;
  descricao?: string;
}

export async function ratearDespesa(input: RatearDespesaInput) {
  const db = getPrismaWithTenant(input.condominioId);

  const unidades = await db.unidade.findMany({
    where: { ativo: true },
    orderBy: { id: "asc" },
  });

  if (unidades.length === 0) {
    throw new AppError("UNPROCESSABLE", "No active unidades to split the expense");
  }

  const loteRateioId = crypto.randomUUID();
  const cobranças = [];

  if (input.criterio === "igual") {
    const valorPorUnidade = Math.round((input.valor / unidades.length) * 100) / 100;
    // Last unit absorbs rounding difference
    let totalDistribuido = 0;

    for (let i = 0; i < unidades.length; i++) {
      const unidade = unidades[i];
      if (!unidade) continue;
      const isLast = i === unidades.length - 1;
      const valor = isLast
        ? Math.round((input.valor - totalDistribuido) * 100) / 100
        : valorPorUnidade;
      totalDistribuido += valorPorUnidade;
      const devedor = await resolverDevedorPorUnidade(db, unidade.id);

      cobranças.push({
        condominioId: input.condominioId,
        unidadeId: unidade.id,
        ...(devedor ? { responsavelId: devedor.userId, devedorId: devedor.id } : {}),
        tipo: "extra_rateio" as const,
        valor,
        competencia: input.competencia,
        vencimento: input.vencimento,
        criterioRateio: "igual" as const,
        loteRateioId,
        ...(input.descricao !== undefined && { descricao: input.descricao }),
      });
    }
  } else {
    // fracao_ideal — proportional to fracaoIdeal
    const totalFracao = unidades.reduce((acc, u) => acc + (u.fracaoIdeal ?? 0), 0);
    if (totalFracao <= 0) {
      throw new AppError(
        "UNPROCESSABLE",
        "fracao_ideal rateio requires fracaoIdeal set on all unidades"
      );
    }

    for (const unidade of unidades) {
      const fracao = unidade.fracaoIdeal ?? 0;
      const valor = Math.round((input.valor * (fracao / totalFracao)) * 100) / 100;
      const devedor = await resolverDevedorPorUnidade(db, unidade.id);
      cobranças.push({
        condominioId: input.condominioId,
        unidadeId: unidade.id,
        ...(devedor ? { responsavelId: devedor.userId, devedorId: devedor.id } : {}),
        tipo: "extra_rateio" as const,
        valor,
        competencia: input.competencia,
        vencimento: input.vencimento,
        criterioRateio: "fracao_ideal" as const,
        loteRateioId,
        ...(input.descricao !== undefined && { descricao: input.descricao }),
      });
    }
  }

  const created = await db.$transaction(
    cobranças.map((data) => db.cobranca.create({ data }))
  );

  return { loteRateioId, count: created.length, cobrancas: created };
}
