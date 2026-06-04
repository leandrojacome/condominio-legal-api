import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { TransicionarStatusInput } from "@/domain/ocorrencias/schemas";
import { validarTransicao, isStatusTerminal } from "./configurar-fluxo";
import { notificationQueue } from "@/infrastructure/queue/workers/notification.worker";

export async function transicionarStatus(
  condominioId: string,
  ocorrenciaId: string,
  atualizadorId: string,
  input: TransicionarStatusInput
) {
  const db = getPrismaWithTenant(condominioId);

  const ocorrencia = await db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
  if (!ocorrencia) {
    throw new AppError("NOT_FOUND", "Ocorrência não encontrada");
  }

  const erroTransicao = await validarTransicao(condominioId, ocorrencia.status, input.novoStatus);
  if (erroTransicao !== null) {
    throw new AppError("UNPROCESSABLE", erroTransicao);
  }

  const terminal = await isStatusTerminal(condominioId, input.novoStatus);

  await db.$transaction(async (tx) => {
    await tx.ocorrenciaHistorico.create({
      data: {
        ocorrenciaId,
        statusAnterior: ocorrencia.status,
        statusNovo: input.novoStatus,
        ...(input.comentario !== undefined && { comentario: input.comentario }),
        autorId: atualizadorId,
      },
    });

    await tx.ocorrencia.update({
      where: { id: ocorrenciaId },
      data: {
        status: input.novoStatus,
        ...(terminal && { encerradaEm: new Date() }),
      },
    });
  });

  await notificationQueue.add("ocorrencia-status-changed", {
    entregaId: ocorrenciaId,
    comunicadoId: ocorrenciaId,
    destinatarioId: ocorrencia.autorId,
    canal: "in_app" as const,
    titulo: "Ocorrência atualizada",
    conteudo: `O status da sua ocorrência "${ocorrencia.titulo}" foi alterado para "${input.novoStatus}".`,
  });

  return db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
}
