import { getPrismaWithTenant } from "@/infrastructure/db/client";
import type { RegistrarAcessoInput } from "@/domain/portaria/schemas";
import { AppError } from "@/lib/errors";

export async function registrarAcesso(
  condominioId: string,
  porteiroId: string,
  input: RegistrarAcessoInput
) {
  const db = getPrismaWithTenant(condominioId);

  let preAutorizacaoId: string | undefined = input.preAutorizacaoId;
  let status: string;

  if (preAutorizacaoId) {
    // Validate the pre-authorization belongs to the destination unit and is still valid
    const preAuth = await db.preAutorizacao.findFirst({
      where: {
        id: preAutorizacaoId,
        unidadeId: input.unidadeDestinoId,
        utilizada: false,
        validoAte: { gte: new Date() },
      },
    });

    if (!preAuth) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Pré-autorização inválida, expirada ou já utilizada"
      );
    }

    // Mark as used; visitor is entering now → no_condominio per spec scenario
    await db.preAutorizacao.update({
      where: { id: preAutorizacaoId },
      data: { utilizada: true },
    });

    status = "no_condominio";
  } else {
    // No pre-auth: status awaits morador confirmation
    status = "aguardando_confirmacao";
    preAutorizacaoId = undefined;
  }

  const statusEnum = status as import("@prisma/client").StatusAcesso;
  const acesso = await db.registroAcesso.create({
    data: {
      condominioId,
      tipo: input.tipo,
      nomeVisitante: input.nomeVisitante,
      ...(input.documento !== undefined && { documento: input.documento }),
      unidadeDestinoId: input.unidadeDestinoId,
      porteiroPorId: porteiroId,
      preAutorizacaoId: preAutorizacaoId ?? null,
      status: statusEnum,
    },
  });

  return acesso;
}
