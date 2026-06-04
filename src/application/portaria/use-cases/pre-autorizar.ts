import { getPrismaWithTenant } from "@/infrastructure/db/client";
import type { PreAutorizarInput } from "@/domain/portaria/schemas";
import { AppError } from "@/lib/errors";

export async function preAutorizar(
  condominioId: string,
  moradorUserId: string,
  input: PreAutorizarInput
) {
  const db = getPrismaWithTenant(condominioId);

  // Ensure the unit belongs to this condominium
  const unidade = await db.unidade.findFirst({
    where: { id: input.unidadeId },
  });

  if (!unidade) {
    throw new AppError("NOT_FOUND", "Unidade não encontrada neste condomínio");
  }

  const validoAte = new Date(input.validoAte);

  if (validoAte <= new Date()) {
    throw new AppError("VALIDATION_ERROR", "validoAte deve ser uma data futura");
  }

  const preAutorizacao = await db.preAutorizacao.create({
    data: {
      condominioId,
      nomeVisitante: input.nomeVisitante,
      unidadeId: input.unidadeId,
      autorizadoPorId: moradorUserId,
      validoAte,
    },
  });

  return preAutorizacao;
}
