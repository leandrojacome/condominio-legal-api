import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export async function statusEntregas(
  condominioId: string,
  comunicadoId: string,
  autorId: string
) {
  const db = getPrismaWithTenant(condominioId);

  const comunicado = await db.comunicado.findFirst({ where: { id: comunicadoId } });
  if (!comunicado) {
    throw new AppError("NOT_FOUND", "Comunicado not found");
  }

  // Only the author can view full delivery status
  if (comunicado.autorId !== autorId) {
    throw new AppError("FORBIDDEN", "Only the author can view delivery status");
  }

  const entregas = await db.entregaComunicado.findMany({
    where: { comunicadoId },
    orderBy: [{ destinatarioId: "asc" }, { canal: "asc" }],
  });

  const lidos = entregas.filter((e) => e.dataCiencia !== null).map((e) => e.destinatarioId);
  const pendentes = entregas.filter((e) => e.dataCiencia === null).map((e) => e.destinatarioId);

  return {
    comunicadoId,
    totalEntregas: entregas.length,
    lidos: [...new Set(lidos)],
    pendentes: [...new Set(pendentes)],
    entregas,
  };
}
