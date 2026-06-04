import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { notificationQueue } from "@/infrastructure/queue/workers/notification.worker";
import type { CriarComunicadoData } from "@/domain/comunicacao/schemas";
import type { CanalNotificacao } from "@prisma/client";

const DEFAULT_CANAIS: CanalNotificacao[] = ["in_app"];

export async function publicarComunicado(
  condominioId: string,
  autorId: string,
  data: CriarComunicadoData
) {
  const db = getPrismaWithTenant(condominioId);
  const canais: CanalNotificacao[] = (data.canais as CanalNotificacao[]) ?? DEFAULT_CANAIS;

  // Find destinatários
  let destinatarioIds: string[] = [];

  if (data.tipo === "aviso_geral" || data.tipo === "convocacao") {
    // All active users linked to this condomínio
    const vinculos = await db.vinculo.findMany({
      where: { ativo: true },
      select: { userId: true, user: { select: { email: true } } },
    });
    destinatarioIds = [...new Set(vinculos.map((v) => v.userId))];
  } else if (data.destinatarioIds && data.destinatarioIds.length > 0) {
    destinatarioIds = data.destinatarioIds;
  }

  const comunicado = await db.comunicado.create({
    data: {
      condominioId,
      autorId,
      titulo: data.titulo,
      conteudo: data.conteudo,
      tipo: data.tipo as import("@prisma/client").TipoComunicado,
    },
  });

  // Create delivery records and enqueue jobs
  const entregas = await Promise.all(
    destinatarioIds.flatMap((destinatarioId) =>
      canais.map(async (canal) => {
        const entrega = await db.entregaComunicado.create({
          data: {
            comunicadoId: comunicado.id,
            destinatarioId,
            canal,
          },
          include: { comunicado: false },
        });

        await notificationQueue.add(
          "send",
          {
            entregaId: entrega.id,
            comunicadoId: comunicado.id,
            destinatarioId,
            canal,
            titulo: comunicado.titulo,
            conteudo: comunicado.conteudo,
          },
          { removeOnComplete: 100, removeOnFail: 50 }
        );

        return entrega;
      })
    )
  );

  return { comunicado, entregasCount: entregas.length };
}
