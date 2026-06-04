import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export interface RegistrarProcuracaoInput {
  condominioId: string;
  assembleiaId: string;
  unidadeRepresentadaId: string;
  procuradorId: string;  // userId
  validoAte: string;     // ISO datetime
}

export async function registrarProcuracao(input: RegistrarProcuracaoInput) {
  const db = getPrismaWithTenant(input.condominioId);

  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia não encontrada");
  }

  if (assembleia.status === "apurada") {
    throw new AppError("UNPROCESSABLE", "Não é possível registrar procuração em assembleia já apurada");
  }

  // Validate unidade belongs to this condomínio
  const unidade = await db.unidade.findFirst({
    where: { id: input.unidadeRepresentadaId, ativo: true },
  });

  if (!unidade) {
    throw new AppError("NOT_FOUND", "Unidade representada não encontrada ou inativa");
  }

  // Validate procurador has an active vínculo in this condomínio
  const vinculoProcurador = await db.vinculo.findFirst({
    where: { userId: input.procuradorId, ativo: true },
  });

  if (!vinculoProcurador) {
    throw new AppError("FORBIDDEN", "Procurador não possui vínculo ativo neste condomínio");
  }

  return db.procuracao.create({
    data: {
      assembleiaId: input.assembleiaId,
      unidadeRepresentadaId: input.unidadeRepresentadaId,
      procuradorId: input.procuradorId,
      validoAte: new Date(input.validoAte),
    },
  });
}
