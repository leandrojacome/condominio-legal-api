import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export async function cancelarReserva(
  condominioId: string,
  reservaId: string,
  userId: string
) {
  const db = getPrismaWithTenant(condominioId);

  const reserva = await db.reserva.findFirst({
    where: { id: reservaId },
    include: { areaComum: true },
  });

  if (!reserva) {
    throw new AppError("NOT_FOUND", "Reserva não encontrada");
  }

  if (reserva.status === "cancelada" || reserva.status === "rejeitada") {
    throw new AppError("UNPROCESSABLE", `Reserva já está ${reserva.status}`);
  }

  // Only the unit's resident or a manager/sindico can cancel
  const vinculo = await db.vinculo.findFirst({
    where: { userId, unidadeId: reserva.unidadeId, ativo: true },
  });

  const isGestor = await db.vinculo.findFirst({
    where: { userId, perfil: { in: ["sindico", "administradora"] }, ativo: true },
  });

  if (!vinculo && !isGestor) {
    throw new AppError("FORBIDDEN", "Sem permissão para cancelar esta reserva");
  }

  // Apply cancellation penalty rule (ARD spec)
  // If canceled within prazoCancelamentoHoras before inicio → no penalty (cancel the charge)
  // If canceled after the deadline has passed → keep charge (penalidade)
  const area = reserva.areaComum;
  const now = new Date();
  const horasAteInicio = (reserva.inicio.getTime() - now.getTime()) / (1000 * 60 * 60);
  const dentroDoPrazo = horasAteInicio >= area.prazoCancelamentoHoras;

  // Cancel (or retain) the associated cobrança
  if (reserva.cobrancaId) {
    if (dentroDoPrazo) {
      // Within cancellation window — cancel the charge (full refund)
      await db.cobranca.update({
        where: { id: reserva.cobrancaId },
        data: { status: "cancelada" },
      });
    }
    // Outside window — charge is retained as penalty (no update needed)
  }

  const updated = await db.reserva.update({
    where: { id: reservaId },
    data: { status: "cancelada" },
  });

  return { reserva: updated, penalidade: !dentroDoPrazo && !!reserva.cobrancaId };
}
