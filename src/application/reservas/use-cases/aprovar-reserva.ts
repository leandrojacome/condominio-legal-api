import { prisma, getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export async function aprovarReserva(
  condominioId: string,
  reservaId: string,
  observacao?: string
) {
  const db = getPrismaWithTenant(condominioId);

  const reserva = await db.reserva.findFirst({
    where: { id: reservaId },
    include: { areaComum: true },
  });

  if (!reserva) {
    throw new AppError("NOT_FOUND", "Reserva não encontrada");
  }

  if (reserva.status !== "pendente") {
    throw new AppError("UNPROCESSABLE", `Reserva não está pendente (status atual: ${reserva.status})`);
  }

  const area = reserva.areaComum;

  // Approve inside a transaction — create charge atomically if taxa applies
  const reservaAtualizada = await prisma.$transaction(async (tx) => {
    let cobrancaId: string | undefined | null = reserva.cobrancaId;

    if (area.taxaUso && area.taxaUso > 0 && !cobrancaId) {
      const competencia = `${reserva.inicio.getFullYear()}-${String(reserva.inicio.getMonth() + 1).padStart(2, "0")}`;
      const cobranca = await tx.cobranca.create({
        data: {
          condominioId,
          unidadeId: reserva.unidadeId,
          tipo: "consumo",
          valor: area.taxaUso,
          competencia,
          vencimento: reserva.inicio,
          descricao: `Taxa de uso — ${area.nome}`,
        },
      });
      cobrancaId = cobranca.id;
    }

    const updated = await tx.reserva.update({
      where: { id: reservaId },
      data: {
        status: "confirmada",
        ...(cobrancaId !== undefined && { cobrancaId }),
      },
    });

    return updated;
  });

  void observacao; // stored in a comment/log if needed in future iterations

  return reservaAtualizada;
}
