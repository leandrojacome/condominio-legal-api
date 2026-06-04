import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { AvaliarOcorrenciaInput } from "@/domain/ocorrencias/schemas";

export async function avaliarOcorrencia(
  condominioId: string,
  ocorrenciaId: string,
  autorId: string,
  input: AvaliarOcorrenciaInput
) {
  const db = getPrismaWithTenant(condominioId);

  const ocorrencia = await db.ocorrencia.findFirst({
    where: { id: ocorrenciaId },
    include: { avaliacao: true },
  });

  if (!ocorrencia) {
    throw new AppError("NOT_FOUND", "Ocorrência não encontrada");
  }

  if (ocorrencia.autorId !== autorId) {
    throw new AppError("FORBIDDEN", "Apenas o autor pode avaliar a ocorrência");
  }

  if (ocorrencia.encerradaEm === null) {
    throw new AppError("UNPROCESSABLE", "A ocorrência precisa estar encerrada para ser avaliada");
  }

  if (ocorrencia.avaliacao !== null) {
    throw new AppError("CONFLICT", "A ocorrência já foi avaliada");
  }

  const avaliacao = await db.avaliacaoOcorrencia.create({
    data: {
      ocorrenciaId,
      classificacao: input.classificacao,
      ...(input.comentario !== undefined && { comentario: input.comentario }),
    },
  });

  return avaliacao;
}
