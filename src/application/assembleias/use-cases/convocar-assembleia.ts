import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { ConvocarAssembleiaInput } from "@/domain/assembleias/schemas";

export interface ConvocarAssembleiaUseCaseInput {
  condominioId: string;
  userId: string;
  data: ConvocarAssembleiaInput;
}

export async function convocarAssembleia(input: ConvocarAssembleiaUseCaseInput) {
  const { condominioId, data } = input;

  if (data.itensPauta.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Assembleia deve ter ao menos um item de pauta");
  }

  const db = getPrismaWithTenant(condominioId);

  const assembleia = await db.assembleia.create({
    data: {
      condominioId,
      titulo: data.titulo,
      dataHora: new Date(data.dataHora),
      ...(data.local !== undefined ? { local: data.local } : {}),
      modalidade: data.modalidade ?? "hibrida",
      status: "convocada",
      itensPauta: {
        create: data.itensPauta.map((item) => ({
          titulo: item.titulo,
          ...(item.descricao !== undefined ? { descricao: item.descricao } : {}),
          criterioVoto: item.criterioVoto,
          quorumMinimo: item.quorumMinimo,
          votoSecreto: item.votoSecreto ?? false,
          ordem: item.ordem,
        })),
      },
    },
    include: {
      itensPauta: {
        orderBy: { ordem: "asc" },
      },
    },
  });

  return assembleia;
}
