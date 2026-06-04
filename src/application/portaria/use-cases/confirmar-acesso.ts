import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { StatusAcesso } from "@prisma/client";
import type { ConfirmarAcessoInput } from "@/domain/portaria/schemas";
import { AppError } from "@/lib/errors";
import { sendPushNotification } from "@/infrastructure/notifications/fcm";

export async function confirmarAcesso(
  condominioId: string,
  acessoId: string,
  input: ConfirmarAcessoInput
) {
  const db = getPrismaWithTenant(condominioId);

  const acesso = await db.registroAcesso.findFirst({
    where: { id: acessoId },
  });

  if (!acesso) {
    throw new AppError("NOT_FOUND", "Registro de acesso não encontrado");
  }

  if (acesso.status !== "aguardando_confirmacao") {
    throw new AppError(
      "UNPROCESSABLE",
      `Acesso não pode ser confirmado: status atual é ${acesso.status}`
    );
  }

  const novoStatus: StatusAcesso =
    input.decisao === "autorizar" ? StatusAcesso.autorizado : StatusAcesso.negado;

  const updated = await db.registroAcesso.update({
    where: { id: acessoId },
    data: { status: novoStatus },
  });

  if (acesso.porteiroPorId) {
    console.log(
      `[portaria] acesso ${acessoId} ${novoStatus} — porteiro ${acesso.porteiroPorId} should be notified`
    );
  }

  return updated;
}

/**
 * Sends a push notification to the morador asking them to confirm an incoming visitor.
 * Called by the porteiro when a visitor arrives without a pre-authorization.
 */
export async function solicitarConfirmacaoMorador(
  moradorFcmToken: string,
  nomeVisitante: string,
  unidade: string,
  acessoId: string
): Promise<void> {
  await sendPushNotification(
    moradorFcmToken,
    "Visitante na portaria",
    `${nomeVisitante} chegou para a unidade ${unidade}. Autorizar acesso?`,
    { acessoId, action: "confirmar_acesso" }
  );
}
