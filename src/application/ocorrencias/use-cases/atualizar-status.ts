import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { TransicionarStatusInput } from "@/domain/ocorrencias/schemas";
import { validarTransicao, isStatusTerminal } from "./configurar-fluxo";
import { notificationQueue } from "@/infrastructure/queue/workers/notification.worker";
import { prisma } from "@/infrastructure/db/client";

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

  // Create proper Comunicado + EntregaComunicado so the notification worker can update
  // the delivery status (entregaId must be a real EntregaComunicado row)
  const titulo = "Ocorrência atualizada";
  const conteudo = `O status da sua ocorrência "${ocorrencia.titulo}" foi alterado para "${input.novoStatus}".`;

  const comunicado = await db.comunicado.create({
    data: {
      condominioId,
      autorId: atualizadorId,
      titulo,
      conteudo,
      tipo: "aviso_individual",
    },
  });

  const entrega = await db.entregaComunicado.create({
    data: { comunicadoId: comunicado.id, destinatarioId: ocorrencia.autorId, canal: "in_app" },
  });

  const destinatario = await prisma.user.findUnique({
    where: { id: ocorrencia.autorId },
    select: { email: true, fcmToken: true },
  });

  await notificationQueue.add(
    "ocorrencia-status-changed",
    {
      entregaId: entrega.id,
      comunicadoId: comunicado.id,
      destinatarioId: ocorrencia.autorId,
      canal: "in_app" as const,
      titulo,
      conteudo,
      destinatarioEmail: destinatario?.email ?? undefined,
      destinatarioFcmToken: destinatario?.fcmToken ?? undefined,
    },
    { removeOnComplete: 100, removeOnFail: 50 }
  );

  return db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
}
