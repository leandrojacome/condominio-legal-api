import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { AtualizarAreaComumInput } from "@/domain/reservas/schemas";
import type { Granularidade, PoliticaConflito, ModoAprovacao } from "@prisma/client";

export async function atualizarAreaComum(
  condominioId: string,
  areaId: string,
  input: AtualizarAreaComumInput
) {
  const db = getPrismaWithTenant(condominioId);

  const existing = await db.areaComum.findFirst({ where: { id: areaId } });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Área comum não encontrada");
  }

  const politica = input.politicaConflito ?? existing.politicaConflito;
  const capacidade = input.capacidade ?? existing.capacidade;
  if (politica === "capacidade" && !capacidade) {
    throw new AppError("VALIDATION_ERROR", "capacidade é obrigatória para política 'capacidade'");
  }

  const area = await db.areaComum.update({
    where: { id: areaId },
    data: {
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(input.granularidade !== undefined && { granularidade: input.granularidade as Granularidade }),
      ...(input.politicaConflito !== undefined && { politicaConflito: input.politicaConflito as PoliticaConflito }),
      ...(input.capacidade !== undefined && { capacidade: input.capacidade }),
      ...(input.modoAprovacao !== undefined && { modoAprovacao: input.modoAprovacao as ModoAprovacao }),
      ...(input.antecedenciaMinimaHoras !== undefined && { antecedenciaMinimaHoras: input.antecedenciaMinimaHoras }),
      ...(input.antecedenciaMaximaDias !== undefined && { antecedenciaMaximaDias: input.antecedenciaMaximaDias }),
      ...(input.limiteReservasPorUnidade !== undefined && { limiteReservasPorUnidade: input.limiteReservasPorUnidade }),
      ...(input.taxaUso !== undefined && { taxaUso: input.taxaUso }),
      ...(input.prazoCancelamentoHoras !== undefined && { prazoCancelamentoHoras: input.prazoCancelamentoHoras }),
      ...(input.ativa !== undefined && { ativa: input.ativa }),
    },
  });

  return area;
}
