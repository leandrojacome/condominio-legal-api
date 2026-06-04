import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/client";
import { z } from "zod";
import { internalError } from "@/lib/errors";

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
    const body = await req.json() as unknown;
    const parsed = PspWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[psp-webhook]", err);
    return internalError() as unknown as Response;
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

  // Idempotency: UNIQUE on externalTxId prevents double reconciliation per ARD §4.4
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

    // Mark all emissões for this cobrança as cancelled (payment by one method closes others)
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
