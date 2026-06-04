// BullMQ repeatable job — marks overdue charges as em_atraso (ARD §3.7)
import { Queue, Worker } from "bullmq";
import { prisma } from "@/infrastructure/db/client";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

// BullMQ uses its own bundled ioredis; pass connection options, not an ioredis instance
const connection = { url: REDIS_URL };

export const inadimplenciaQueue = new Queue("inadimplencia", { connection });

export function startInadimplenciaWorker() {
  const worker = new Worker(
    "inadimplencia",
    async () => {
      const now = new Date();
      const { count } = await prisma.cobranca.updateMany({
        where: { status: "em_aberto", vencimento: { lt: now } },
        data: { status: "em_atraso" },
      });
      console.log(`[inadimplencia-job] Marked ${count} cobrancas as em_atraso`);
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
