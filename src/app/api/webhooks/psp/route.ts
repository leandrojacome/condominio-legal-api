import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/infrastructure/db/client";
import { z } from "zod";
import { internalError, unauthorizedError, validationError } from "@/lib/errors";

// Efí Bank webhook payload shape (simplified)
const PspWebhookSchema = z.object({
  evento: z.string(),
  pix: z
    .array(
      z.object({
        endToEndId: z.string(),
        txid: z.string(),
        valor: z.string(),
        horario: z.string(),
        status: z.string().optional(),
      })
    )
    .optional(),
  // Boleto events use a different payload format
  cobrancas: z
    .array(
      z.object({
        nossoNumero: z.string(),
        valor: z.number(),
        dataPagamento: z.string(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Validate HMAC-SHA256 signature from Efí Bank (blocker: unauthenticated webhook)
    const signature = req.headers.get("x-efipay-signature");
    const webhookSecret = process.env["WEBHOOK_SECRET"];

    if (!webhookSecret) {
      console.error("[psp-webhook] WEBHOOK_SECRET is not configured");
      return unauthorizedError("Unauthorized");
    }

    if (!signature) {
      return unauthorizedError("Missing signature");
    }

    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return unauthorizedError("Invalid signature");
    }

    const body = JSON.parse(rawBody) as unknown;
    const parsed = PspWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const { pix, cobrancas } = parsed.data;

    // Process Pix payments
    if (pix && pix.length > 0) {
      for (const pagamentoPix of pix) {
        await conciliarPagamento({
          externalTxId: pagamentoPix.endToEndId,
          externalId: pagamentoPix.txid,
          valor: parseFloat(pagamentoPix.valor),
          dataPagamento: new Date(pagamentoPix.horario),
          metodo: "pix",
        });
      }
    }

    // Process Boleto payments
    if (cobrancas && cobrancas.length > 0) {
      for (const pagamentoBoleto of cobrancas) {
        await conciliarPagamento({
          externalTxId: `boleto-${pagamentoBoleto.nossoNumero}-${pagamentoBoleto.dataPagamento}`,
          externalId: pagamentoBoleto.nossoNumero,
          valor: pagamentoBoleto.valor,
          dataPagamento: new Date(pagamentoBoleto.dataPagamento),
          metodo: "boleto",
        });
      }
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error("[psp-webhook]", err);
    return internalError();
  }
}

interface ConciliarInput {
  externalTxId: string;
  externalId: string;
  valor: number;
  dataPagamento: Date;
  metodo: "boleto" | "pix";
}

async function conciliarPagamento(input: ConciliarInput) {
  // Find the emissão by externalId for idempotency check
  const emissao = await prisma.cobrancaEmissao.findUnique({
    where: { externalId: input.externalId },
  });

  if (!emissao) {
    console.warn(`[psp-webhook] No emissao found for externalId=${input.externalId}`);
    return;
  }

  // Idempotency: UNIQUE on externalTxId / externalTransactionId prevents double reconciliation per ARD §4.4
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pagamento.findUnique({
      where: { externalTxId: input.externalTxId },
    });
    if (existing) return; // already processed — no-op

    await tx.pagamento.create({
      data: {
        cobrancaId: emissao.cobrancaId,
        valor: input.valor,
        metodo: input.metodo,
        dataPagamento: input.dataPagamento,
        externalTxId: input.externalTxId,
      },
    });

    // Append-only audit log per ARD §3.9
    await tx.conciliacaoLog.create({
      data: {
        cobrancaId: emissao.cobrancaId,
        externalTransactionId: input.externalTxId,
        metodo: input.metodo,
        valorPago: input.valor,
        dataEvento: input.dataPagamento,
      },
    });

    // Payment by one method closes all others (ARD §4.4)
    await tx.cobrancaEmissao.updateMany({
      where: { cobrancaId: emissao.cobrancaId, status: "emitido" },
      data: { status: "cancelado" },
    });

    await tx.cobranca.update({
      where: { id: emissao.cobrancaId },
      data: { status: "paga" },
    });
  });
}
