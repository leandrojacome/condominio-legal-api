import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export interface AbrirVotacaoInput {
  condominioId: string;
  assembleiaId: string;
}

export async function abrirVotacao(input: AbrirVotacaoInput) {
  const db = getPrismaWithTenant(input.condominioId);

  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
    include: { itensPauta: true },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia não encontrada");
  }

  if (assembleia.status !== "convocada") {
    throw new AppError("UNPROCESSABLE", "Apenas assembleias com status 'convocada' podem ser abertas para votação");
  }

  if (assembleia.itensPauta.length === 0) {
    throw new AppError("UNPROCESSABLE", "Assembleia deve ter ao menos um item de pauta");
  }

  return db.assembleia.update({
    where: { id: input.assembleiaId },
    data: { status: "em_votacao" },
    include: { itensPauta: { orderBy: { ordem: "asc" } } },
  });
}
