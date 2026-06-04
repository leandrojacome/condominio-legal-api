// Notification queue worker per ARD §3.6
// Uses Promise.allSettled — failure in one channel does NOT block others.

import { Queue, Worker } from "bullmq";
import { prisma } from "@/infrastructure/db/client";
import { sendEmail } from "@/infrastructure/notifications/email";
import { sendPushNotification } from "@/infrastructure/notifications/fcm";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const connection = { url: REDIS_URL };

export const notificationQueue = new Queue("notifications", { connection });

export interface NotificationJob {
  entregaId: string;
  comunicadoId: string;
  destinatarioId: string;
  canal: "in_app" | "email" | "push" | "sms_whatsapp";
  titulo: string;
  conteudo: string;
  destinatarioEmail?: string;
  destinatarioFcmToken?: string;
}

export function startNotificationWorker() {
  const worker = new Worker<NotificationJob>(
    "notifications",
    async (job) => {
      const { entregaId, canal, titulo, conteudo, destinatarioEmail, destinatarioFcmToken } =
        job.data;

      let success = false;

      switch (canal) {
        case "email":
          if (destinatarioEmail) {
            success = await sendEmail(destinatarioEmail, titulo, `<p>${conteudo}</p>`);
          }
          break;
        case "push":
          if (destinatarioFcmToken) {
            success = await sendPushNotification(destinatarioFcmToken, titulo, conteudo);
          }
          break;
        case "in_app":
          // in_app is persisted in DB; delivery is via polling/SSE — mark as sent immediately
          success = true;
          break;
        case "sms_whatsapp":
          // TODO: Twilio/Z-API integration
          console.log(`[notification] SMS/WhatsApp not yet implemented for entregaId=${entregaId}`);
          success = false;
          break;
      }

      await prisma.entregaComunicado.update({
        where: { id: entregaId },
        data: { status: success ? "enviado" : "falha" },
      });
    },
    {
      connection,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[notification-worker] Failed job ${job?.id}:`, err);
  });

  return worker;
}
