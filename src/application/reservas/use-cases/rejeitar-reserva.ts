import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export async function rejeitarReserva(
  condominioId: string,
  reservaId: string,
  motivo: string
) {
  const db = getPrismaWithTenant(condominioId);

  const reserva = await db.reserva.findFirst({ where: { id: reservaId } });
  if (!reserva) {
    throw new AppError("NOT_FOUND", "Reserva não encontrada");
  }

  if (reserva.status !== "pendente") {
    throw new AppError("UNPROCESSABLE", `Apenas reservas pendentes podem ser rejeitadas (status atual: ${reserva.status})`);
  }

  const updated = await db.reserva.update({
    where: { id: reservaId },
    data: { status: "rejeitada" },
  });

  void motivo; // motivo stored in a comment/log in future iterations

  return updated;
}
