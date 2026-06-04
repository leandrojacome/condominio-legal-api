import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export async function obterComunicado(
  condominioId: string,
  comunicadoId: string,
  requestingUserId: string
) {
  const db = getPrismaWithTenant(condominioId);

  const comunicado = await db.comunicado.findFirst({
    where: { id: comunicadoId },
    include: {
      entregas: {
        where: { destinatarioId: requestingUserId },
        select: { canal: true, status: true, dataCiencia: true },
      },
    },
  });

  if (!comunicado) {
    throw new AppError("NOT_FOUND", "Comunicado not found");
  }

  return comunicado;
}
