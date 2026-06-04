import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export async function confirmarLeitura(
  condominioId: string,
  comunicadoId: string,
  userId: string
) {
  const db = getPrismaWithTenant(condominioId);

  // Verify comunicado belongs to this tenant
  const comunicado = await db.comunicado.findFirst({ where: { id: comunicadoId } });
  if (!comunicado) {
    throw new AppError("NOT_FOUND", "Comunicado not found");
  }

  // Update all delivery records for this user marking dataCiencia
  const result = await db.entregaComunicado.updateMany({
    where: {
      comunicadoId,
      destinatarioId: userId,
      dataCiencia: null, // only if not already read
    },
    data: { dataCiencia: new Date() },
  });

  return { confirmedCount: result.count };
}
