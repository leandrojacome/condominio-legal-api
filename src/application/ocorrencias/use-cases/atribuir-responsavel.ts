import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { AtribuirResponsavelInput } from "@/domain/ocorrencias/schemas";
import type { PrioridadeOcorrencia } from "@prisma/client";
import { agendarJobSLA } from "@/infrastructure/queue/sla-job";

export async function atribuirResponsavel(
  condominioId: string,
  ocorrenciaId: string,
  input: AtribuirResponsavelInput
) {
  const db = getPrismaWithTenant(condominioId);

  const ocorrencia = await db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
  if (!ocorrencia) {
    throw new AppError("NOT_FOUND", "Ocorrência não encontrada");
  }

  const updated = await db.ocorrencia.update({
    where: { id: ocorrenciaId },
    data: {
      responsavelId: input.responsavelId,
      ...(input.prioridade !== undefined && {
        prioridade: input.prioridade as PrioridadeOcorrencia,
      }),
      ...(input.slaHoras !== undefined && { slaHoras: input.slaHoras }),
    },
  });

  if (input.slaHoras !== undefined && ocorrencia.slaHoras === null) {
    await agendarJobSLA(ocorrenciaId, input.slaHoras);
  }

  return updated;
}
