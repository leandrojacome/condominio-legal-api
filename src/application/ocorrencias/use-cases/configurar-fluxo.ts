import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import type { ConfigurarFluxoInput } from "@/domain/ocorrencias/schemas";
import { AppError } from "@/lib/errors";

/**
 * Replaces the entire status flow for a condominium.
 * All existing FluxoStatus and FluxoTransicao records for the condominium are deleted
 * and recreated atomically. Requires at least one initial status.
 */
export async function configurarFluxo(condominioId: string, input: ConfigurarFluxoInput) {
  const iniciaisCount = input.statuses.filter((s) => s.inicial).length;
  if (iniciaisCount !== 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "O fluxo deve ter exatamente um status inicial"
    );
  }

  const terminaisCount = input.statuses.filter((s) => s.terminal).length;
  if (terminaisCount < 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "O fluxo deve ter pelo menos um status terminal"
    );
  }

  const nomesDefinidos = new Set(input.statuses.map((s) => s.nome));
  for (const t of input.transicoes) {
    if (!nomesDefinidos.has(t.de)) {
      throw new AppError("VALIDATION_ERROR", `Transição referencia status desconhecido: "${t.de}"`);
    }
    if (!nomesDefinidos.has(t.para)) {
      throw new AppError("VALIDATION_ERROR", `Transição referencia status desconhecido: "${t.para}"`);
    }
  }

  const db = getPrismaWithTenant(condominioId);

  return prisma.$transaction(async (tx) => {
    // Delete existing transitions first (FK constraint)
    await tx.fluxoTransicao.deleteMany({ where: { condominioId } });
    await tx.fluxoStatus.deleteMany({ where: { condominioId } });

    // Create new statuses
    const createdStatuses = await Promise.all(
      input.statuses.map((s, idx) =>
        tx.fluxoStatus.create({
          data: {
            condominioId,
            nome: s.nome,
            ...(s.descricao !== undefined && { descricao: s.descricao }),
            inicial: s.inicial ?? false,
            terminal: s.terminal ?? false,
            ordem: s.ordem ?? idx,
          },
        })
      )
    );

    const statusByNome = new Map(createdStatuses.map((s) => [s.nome, s]));

    // Create transitions
    await Promise.all(
      input.transicoes.map((t) => {
        const origem = statusByNome.get(t.de)!;
        const destino = statusByNome.get(t.para)!;
        return tx.fluxoTransicao.create({
          data: {
            condominioId,
            statusOrigemId: origem.id,
            statusDestinoId: destino.id,
          },
        });
      })
    );

    return { statuses: createdStatuses, transicoes: input.transicoes };
  });

  void db; // db unused here (direct tx), kept for consistency
}

/** Returns the current flow config for a condominium. */
export async function obterFluxo(condominioId: string) {
  const statuses = await prisma.fluxoStatus.findMany({
    where: { condominioId },
    orderBy: { ordem: "asc" },
    include: {
      transicoesOrigem: {
        include: { statusDestino: true },
      },
    },
  });
  return statuses;
}

/** Returns the initial status name for a condominium flow. */
export async function getStatusInicial(condominioId: string): Promise<string> {
  const status = await prisma.fluxoStatus.findFirst({
    where: { condominioId, inicial: true },
  });
  if (!status) {
    // Default fallback if no flow configured
    return "aberta";
  }
  return status.nome;
}

/**
 * Validates that `de → para` is a permitted transition.
 * Returns null if allowed, or an error message if not.
 */
export async function validarTransicao(
  condominioId: string,
  deNome: string,
  paraNome: string
): Promise<string | null> {
  const origem = await prisma.fluxoStatus.findUnique({
    where: { condominioId_nome: { condominioId, nome: deNome } },
  });
  if (!origem) {
    // No configured flow — allow any transition (permissive fallback)
    return null;
  }

  const destino = await prisma.fluxoStatus.findUnique({
    where: { condominioId_nome: { condominioId, nome: paraNome } },
  });
  if (!destino) {
    return `Status "${paraNome}" não existe no fluxo deste condomínio`;
  }

  const transicao = await prisma.fluxoTransicao.findFirst({
    where: {
      condominioId,
      statusOrigemId: origem.id,
      statusDestinoId: destino.id,
    },
  });

  if (!transicao) {
    return `Transição "${deNome}" → "${paraNome}" não é permitida`;
  }

  return null;
}

/** Returns true if the given status is marked as terminal in the flow. */
export async function isStatusTerminal(condominioId: string, nome: string): Promise<boolean> {
  const status = await prisma.fluxoStatus.findUnique({
    where: { condominioId_nome: { condominioId, nome } },
  });
  return status?.terminal ?? false;
}
