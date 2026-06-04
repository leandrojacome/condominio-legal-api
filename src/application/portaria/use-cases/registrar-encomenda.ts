import { getPrismaWithTenant } from "@/infrastructure/db/client";
import type { RegistrarEncomendaInput } from "@/domain/portaria/schemas";
import { AppError } from "@/lib/errors";
import { notificarEncomenda } from "./notificar-encomenda";

export async function registrarEncomenda(
  condominioId: string,
  porteiroId: string,
  input: RegistrarEncomendaInput
) {
  const db = getPrismaWithTenant(condominioId);

  // Ensure the unit exists in this condominium
  const unidade = await db.unidade.findFirst({
    where: { id: input.unidadeDestinoId },
  });

  if (!unidade) {
    throw new AppError("NOT_FOUND", "Unidade de destino não encontrada neste condomínio");
  }

  const encomenda = await db.encomenda.create({
    data: {
      condominioId,
      unidadeDestinoId: input.unidadeDestinoId,
      ...(input.remetente !== undefined ? { remetente: input.remetente } : {}),
      ...(input.fotoKey !== undefined ? { fotoKey: input.fotoKey } : {}),
    },
  });

  // Notify the resident (best-effort — do not fail the registration if notification fails)
  void notificarEncomenda(condominioId, encomenda.id, input.unidadeDestinoId).catch((err) => {
    console.error("[portaria] notificarEncomenda failed:", err);
  });

  return encomenda;
}
