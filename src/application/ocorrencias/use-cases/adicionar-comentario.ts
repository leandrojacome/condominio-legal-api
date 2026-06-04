import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { AdicionarComentarioInput } from "@/domain/ocorrencias/schemas";
import { notificationQueue } from "@/infrastructure/queue/workers/notification.worker";

export async function adicionarComentario(
  condominioId: string,
  ocorrenciaId: string,
  autorId: string,
  input: AdicionarComentarioInput
) {
  const db = getPrismaWithTenant(condominioId);

  const ocorrencia = await db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
  if (!ocorrencia) {
    throw new AppError("NOT_FOUND", "Ocorrência não encontrada");
  }

  const entrada = await prisma.ocorrenciaHistorico.create({
    data: {
      ocorrenciaId,
      statusAnterior: ocorrencia.status,
      statusNovo: ocorrencia.status,
      comentario: input.comentario,
      autorId,
    },
  });

  if (ocorrencia.autorId !== autorId) {
    await notificationQueue.add("ocorrencia-comentario", {
      entregaId: entrada.id,
      comunicadoId: ocorrenciaId,
      destinatarioId: ocorrencia.autorId,
      canal: "in_app" as const,
      titulo: "Novo comentário na sua ocorrência",
      conteudo: `Um novo comentário foi adicionado à sua ocorrência "${ocorrencia.titulo}".`,
    });
  }

  return entrada;
}
