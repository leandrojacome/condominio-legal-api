// BullMQ repeatable job — marks overdue charges as em_atraso (ARD §3.7)
import { Queue, Worker } from "bullmq";
import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import { notificationQueue } from "./workers/notification.worker";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

// BullMQ uses its own bundled ioredis; pass connection options, not an ioredis instance
const connection = { url: REDIS_URL };

export const inadimplenciaQueue = new Queue("inadimplencia", { connection });

export function startInadimplenciaWorker() {
  const worker = new Worker(
    "inadimplencia",
    async () => {
      const now = new Date();

      // Find overdue cobranças before updating (updateMany does not return rows)
      const overdueCobrancas = await prisma.cobranca.findMany({
        where: { status: "em_aberto", vencimento: { lt: now } },
        select: { id: true, condominioId: true, unidadeId: true },
      });

      if (overdueCobrancas.length === 0) return;

      const cobrancaIds = overdueCobrancas.map((c) => c.id);
      const unidadeIds = [...new Set(overdueCobrancas.map((c) => c.unidadeId))];

      await prisma.$transaction([
        // Mark cobranças em_atraso
        prisma.cobranca.updateMany({
          where: { id: { in: cobrancaIds } },
          data: { status: "em_atraso" },
        }),
        // Sync Vinculo.inadimplente for all active vinculos of affected units
        prisma.vinculo.updateMany({
          where: { unidadeId: { in: unidadeIds }, ativo: true },
          data: { inadimplente: true },
        }),
      ]);

      console.log(
        `[inadimplencia-job] Marked ${cobrancaIds.length} cobrancas as em_atraso, ` +
        `updated inadimplente on vinculos for ${unidadeIds.length} units`
      );

      // Notificar responsáveis financeiros (spec Financeiro §6)
      const responsaveis = await prisma.vinculo.findMany({
        where: {
          unidadeId: { in: unidadeIds },
          ativo: true,
          papel: "responsavel_financeiro",
        },
        include: { user: { select: { id: true, email: true, fcmToken: true } } },
      });

      for (const vinculo of responsaveis) {
        const condominioCobrancas = overdueCobrancas.filter(
          (c) => c.unidadeId === vinculo.unidadeId
        );
        if (condominioCobrancas.length === 0) continue;

        const condominioId = condominioCobrancas[0]!.condominioId;

        // Create in_app notification record
        const tenantDb = getPrismaWithTenant(condominioId);
        const comunicado = await tenantDb.$transaction(async (tx) => {
          const com = await tx.comunicado.create({
            data: {
              condominioId,
              // Known limitation: until there is a system user, keep the recipient as autorId.
              autorId: vinculo.userId,
              titulo: "Cobrança(s) em atraso",
              conteudo: `Você possui ${condominioCobrancas.length} cobrança(s) vencida(s). Regularize para evitar encargos.`,
              tipo: "aviso_individual",
            },
          });
          const entrega = await tx.entregaComunicado.create({
            data: { comunicadoId: com.id, destinatarioId: vinculo.userId, canal: "in_app" },
          });
          return { com, entrega };
        });

        await notificationQueue.add(
          "inadimplencia-alert",
          {
            entregaId: comunicado.entrega.id,
            comunicadoId: comunicado.com.id,
            destinatarioId: vinculo.userId,
            canal: "in_app" as const,
            titulo: "Cobrança(s) em atraso",
            conteudo: `Você possui ${condominioCobrancas.length} cobrança(s) vencida(s). Regularize para evitar encargos.`,
            destinatarioEmail: vinculo.user.email ?? undefined,
            destinatarioFcmToken: vinculo.user.fcmToken ?? undefined,
          },
          { removeOnComplete: 100, removeOnFail: 50 }
        );
      }
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error(`[inadimplencia-job] Failed job ${job?.id}:`, err);
  });

  return worker;
}

export async function scheduleInadimplenciaJob() {
  await inadimplenciaQueue.upsertJobScheduler(
    "daily-inadimplencia",
    { pattern: "0 1 * * *" },
    { name: "check-overdue" }
  );
}
