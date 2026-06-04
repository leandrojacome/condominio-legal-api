import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { CriarAreaComumInput } from "@/domain/reservas/schemas";
import type { Granularidade, PoliticaConflito, ModoAprovacao } from "@prisma/client";

export async function criarAreaComum(condominioId: string, input: CriarAreaComumInput) {
  const db = getPrismaWithTenant(condominioId);

  if (input.politicaConflito === "capacidade" && !input.capacidade) {
    throw new AppError("VALIDATION_ERROR", "capacidade é obrigatória para política 'capacidade'");
  }

  const area = await db.areaComum.create({
    data: {
      condominioId,
      nome: input.nome,
      granularidade: input.granularidade as Granularidade,
      politicaConflito: input.politicaConflito as PoliticaConflito,
      ...(input.capacidade !== undefined && { capacidade: input.capacidade }),
      modoAprovacao: input.modoAprovacao as ModoAprovacao,
      ...(input.antecedenciaMinimaHoras !== undefined && { antecedenciaMinimaHoras: input.antecedenciaMinimaHoras }),
      ...(input.antecedenciaMaximaDias !== undefined && { antecedenciaMaximaDias: input.antecedenciaMaximaDias }),
      ...(input.limiteReservasPorUnidade !== undefined && { limiteReservasPorUnidade: input.limiteReservasPorUnidade }),
      ...(input.taxaUso !== undefined && { taxaUso: input.taxaUso }),
      ...(input.prazoCancelamentoHoras !== undefined && { prazoCancelamentoHoras: input.prazoCancelamentoHoras }),
    },
  });

  return area;
}
