// BullMQ delayed job — marks ocorrencias as sla_estourado (ARD §3.7)
import { Queue, Worker } from "bullmq";
import { prisma } from "@/infrastructure/db/client";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const connection = { url: REDIS_URL };

export const slaQueue = new Queue("ocorrencias-sla", { connection });

interface SlaJobData {
  ocorrenciaId: string;
}

export async function agendarJobSLA(ocorrenciaId: string, slaHoras: number) {
  const delayMs = slaHoras * 60 * 60 * 1000;
  await slaQueue.add(
    "check-sla",
    { ocorrenciaId } satisfies SlaJobData,
    {
      delay: delayMs,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
    }
  );
}

export function startSlaWorker() {
  const worker = new Worker<SlaJobData>(
    "ocorrencias-sla",
    async (job) => {
      const { ocorrenciaId } = job.data;

      const ocorrencia = await prisma.ocorrencia.findUnique({
        where: { id: ocorrenciaId },
      });

      if (!ocorrencia) return;
      if (ocorrencia.encerradaEm !== null) return; // already closed — SLA not breached

      await prisma.ocorrencia.update({
        where: { id: ocorrenciaId },
        data: { slaEstourado: true },
      });

      console.log(`[sla-job] SLA estourado para ocorrência ${ocorrenciaId}`);
    },
    {
      connection,
      concurrency: 10,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[sla-job] Failed job ${job?.id}:`, err);
  });

  return worker;
}
