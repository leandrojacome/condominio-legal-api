import { prisma, getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { OpcaoVoto } from "@prisma/client";

export interface RegistrarVotoInput {
  condominioId: string;
  assembleiaId: string;
  itemPautaId: string;
  userId: string;
  opcao: OpcaoVoto;
  // Optional: vote on behalf of another unit via procuração
  unidadeId?: string;
}

export async function registrarVoto(input: RegistrarVotoInput) {
  const db = getPrismaWithTenant(input.condominioId);

  // Verify assembleia exists and is em_votacao
  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia não encontrada");
  }

  if (assembleia.status !== "em_votacao") {
    throw new AppError("UNPROCESSABLE", "Assembleia não está em votação");
  }

  // Verify itemPauta belongs to this assembleia
  const itemPauta = await db.itemPauta.findFirst({
    where: {
      id: input.itemPautaId,
      assembleiaId: input.assembleiaId,
    },
  });

  if (!itemPauta) {
    throw new AppError("NOT_FOUND", "Item de pauta não encontrado");
  }

  // Determine which unidade is voting
  let unidadeVotanteId: string;
  let procuradorId: string | null = null;

  if (input.unidadeId) {
    // Voting via procuração — verify valid procuração exists
    const agora = new Date();
    const procuracao = await db.procuracao.findFirst({
      where: {
        assembleiaId: input.assembleiaId,
        unidadeRepresentadaId: input.unidadeId,
        procuradorId: input.userId,
        validoAte: { gte: agora },
      },
    });

    if (!procuracao) {
      throw new AppError("FORBIDDEN", "Procuração inválida ou expirada para esta unidade");
    }

    // Check inadimplência for the represented unidade
    const vinculoRepresentado = await db.vinculo.findFirst({
      where: { unidadeId: input.unidadeId, ativo: true, inadimplente: true },
    });

    if (vinculoRepresentado) {
      throw new AppError("FORBIDDEN", "Unidade representada está inadimplente e não pode votar");
    }

    unidadeVotanteId = input.unidadeId;
    procuradorId = input.userId;
  } else {
    // Direct vote — find user's own vínculo
    const vinculo = await db.vinculo.findFirst({
      where: { userId: input.userId, ativo: true },
    });

    if (!vinculo) {
      throw new AppError("FORBIDDEN", "Usuário não possui vínculo ativo neste condomínio");
    }

    if (vinculo.inadimplente) {
      throw new AppError("FORBIDDEN", "Inadimplente não pode votar");
    }

    unidadeVotanteId = vinculo.unidadeId;
  }

  // Determine vote weight based on criterioVoto
  let peso = 1.0;
  if (itemPauta.criterioVoto === "por_fracao") {
    const unidade = await db.unidade.findFirst({
      where: { id: unidadeVotanteId },
    });
    peso = unidade?.fracaoIdeal ?? 1.0;
  }

  // Create Voto and VotoAuditoria in a single transaction (idempotent via UNIQUE constraint)
  try {
    const result = await prisma.$transaction(async (tx) => {
      const voto = await tx.voto.create({
        data: {
          itemPautaId: input.itemPautaId,
          unidadeVotanteId,
          procuradorId,
          opcao: input.opcao,
          peso,
        },
      });

      // VotoAuditoria is append-only per ARD §3.9
      await tx.votoAuditoria.create({
        data: {
          itemPautaId: input.itemPautaId,
          unidadeVotanteId,
          opcao: input.opcao,
          peso,
        },
      });

      return voto;
    });

    return result;
  } catch (err: unknown) {
    // P2002 = unique constraint violation (voto duplicado)
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
