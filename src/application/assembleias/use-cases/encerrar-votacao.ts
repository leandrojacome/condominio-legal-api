import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export interface EncerrarVotacaoInput {
  condominioId: string;
  assembleiaId: string;
}

export async function encerrarVotacao(input: EncerrarVotacaoInput) {
  const db = getPrismaWithTenant(input.condominioId);

  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia não encontrada");
  }

  if (assembleia.status !== "em_votacao") {
    throw new AppError("UNPROCESSABLE", "Apenas assembleias com status 'em_votacao' podem ser encerradas");
  }

  return db.assembleia.update({
    where: { id: input.assembleiaId },
    data: { status: "votacao_encerrada" },
    include: { itensPauta: { orderBy: { ordem: "asc" } } },
  });
}
