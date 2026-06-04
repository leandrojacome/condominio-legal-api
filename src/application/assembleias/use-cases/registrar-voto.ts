import { prisma, getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { OpcaoVoto } from "@prisma/client";

export interface RegistrarVotoInput {
  condominioId: string;
  assembleiaId: string;
  itemPautaId: string;
  userId: string;
  opcao: OpcaoVoto;
}

export async function registrarVoto(input: RegistrarVotoInput) {
  const db = getPrismaWithTenant(input.condominioId);

  // Find the user's vinculo for this condominio
  const vinculo = await db.vinculo.findFirst({
    where: {
      userId: input.userId,
      ativo: true,
    },
  });

  if (!vinculo) {
    throw new AppError("FORBIDDEN", "Usuário não possui vínculo ativo neste condomínio");
  }

  // Block inadimplentes
  if (vinculo.inadimplente) {
    throw new AppError("FORBIDDEN", "Inadimplente não pode votar");
  }

  // Verify assembleia exists and is em_votacao
  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia not found");
  }

  if (assembleia.status !== "em_votacao") {
    throw new AppError("FORBIDDEN", "Assembleia não está em votação");
  }

  // Verify itemPauta belongs to this assembleia
  const itemPauta = await prisma.itemPauta.findFirst({
    where: {
      id: input.itemPautaId,
      assembleiaId: input.assembleiaId,
    },
  });

  if (!itemPauta) {
    throw new AppError("NOT_FOUND", "Item de pauta not found");
  }

  // Determine weight based on criterioVoto
  let peso = 1.0;
  if (itemPauta.criterioVoto === "por_fracao") {
    const unidade = await prisma.unidade.findFirst({
      where: { id: vinculo.unidadeId },
    });
    peso = unidade?.fracaoIdeal ?? 1.0;
  }

  // Create Voto and VotoAuditoria in a single transaction (idempotent)
  try {
    const result = await prisma.$transaction(async (tx) => {
      const voto = await tx.voto.create({
        data: {
          itemPautaId: input.itemPautaId,
          unidadeVotanteId: vinculo.unidadeId,
          procuradorId: null,
          opcao: input.opcao,
          peso,
        },
      });

      await tx.votoAuditoria.create({
        data: {
          itemPautaId: input.itemPautaId,
          unidadeVotanteId: vinculo.unidadeId,
          opcao: input.opcao,
          peso,
        },
      });

      return voto;
    });

    return result;
  } catch (err: unknown) {
    // Catch unique constraint violation (voto already exists for this unidade+item)
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("CONFLICT", "Voto já registrado para esta unidade nesta pauta");
    }
    throw err;
  }
}
