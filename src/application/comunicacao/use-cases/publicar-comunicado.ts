import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import { notificationQueue } from "@/infrastructure/queue/workers/notification.worker";
import type { CriarComunicadoData } from "@/domain/comunicacao/schemas";
import { AppError } from "@/lib/errors";
import type { CanalNotificacao } from "@prisma/client";

const DEFAULT_CANAIS: CanalNotificacao[] = ["in_app"];

export async function publicarComunicado(
  condominioId: string,
  autorId: string,
  data: CriarComunicadoData
) {
  const db = getPrismaWithTenant(condominioId);
  const canais: CanalNotificacao[] = (data.canais as CanalNotificacao[]) ?? DEFAULT_CANAIS;

  // Validate: segmentado/individual require destinatarioIds
  if (
    (data.tipo === "aviso_segmentado" || data.tipo === "aviso_individual") &&
    (!data.destinatarioIds || data.destinatarioIds.length === 0)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "destinatarioIds is required for aviso_segmentado and aviso_individual"
    );
  }

  // Resolve destinatários
  let destinatarioIds: string[] = [];

  if (data.tipo === "aviso_geral" || data.tipo === "convocacao") {
    const vinculos = await db.vinculo.findMany({
      where: { ativo: true },
      select: { userId: true },
    });
    destinatarioIds = [...new Set(vinculos.map((v) => v.userId))];
  } else if (data.destinatarioIds && data.destinatarioIds.length > 0) {
    destinatarioIds = data.destinatarioIds;
  }

  // Fetch email and fcmToken for all destinatários upfront
  const users = await prisma.user.findMany({
    where: { id: { in: destinatarioIds } },
    select: { id: true, email: true, fcmToken: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

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
          data: { comunicadoId: comunicado.id, destinatarioId, canal },
        });

        const user = userMap.get(destinatarioId);
        await notificationQueue.add(
          "send",
          {
            entregaId: entrega.id,
            comunicadoId: comunicado.id,
            destinatarioId,
            canal,
            titulo: comunicado.titulo,
            conteudo: comunicado.conteudo,
            destinatarioEmail: user?.email ?? undefined,
            destinatarioFcmToken: user?.fcmToken ?? undefined,
          },
          { removeOnComplete: 100, removeOnFail: 50 }
        );

        return entrega;
      })
    )
  );

  return { comunicado, entregasCount: entregas.length };
}
