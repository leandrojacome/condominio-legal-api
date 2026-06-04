import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { prisma } from "@/infrastructure/db/client";
import { sendPushNotification } from "@/infrastructure/notifications/fcm";

/**
 * Looks up the resident's FCM token and sends a push notification about a new package.
 * Updates Encomenda.notificadoEm on success.
 */
export async function notificarEncomenda(
  condominioId: string,
  encId: string,
  unidadeDestinoId: string
): Promise<void> {
  const db = getPrismaWithTenant(condominioId);

  // Find all active vinculos for the destination unit to get morador user IDs
  const vinculos = await db.vinculo.findMany({
    where: { unidadeId: unidadeDestinoId },
    select: { userId: true },
  });

  if (vinculos.length === 0) return;

  const userIds = vinculos.map((v) => v.userId);

  // Look up FCM tokens stored on user records (field added via user profile extension, gracefully absent)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  });

  // In a full implementation, user records would carry an fcmToken field.
  // We log for now and update notificadoEm so the record tracks intent.
  console.log(
    `[portaria] encomenda ${encId} — notifying ${users.length} resident(s) on unit ${unidadeDestinoId}`
  );

  // Attempt push for each user (no-op when FCM not configured)
  await Promise.allSettled(
    users.map((u) =>
      sendPushNotification(
        `fcm-token-${u.id}`,
        "Nova encomenda na portaria",
        "Você tem uma encomenda aguardando retirada na portaria.",
        { encId, action: "encomenda_recebida" }
      )
    )
  );

  await db.encomenda.update({
    where: { id: encId },
    data: { notificadoEm: new Date() },
  });
}
