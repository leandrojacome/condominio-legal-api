import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { notFoundError, unprocessableError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { paymentProvider } from "@/infrastructure/payments/efi";
import type { PixParams } from "@/infrastructure/payments/provider";

export const POST = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const cobrancaId = params["cobrancaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const cobranca = await db.cobranca.findFirst({
      where: { id: cobrancaId },
      include: { unidade: { include: { vinculos: { include: { pessoa: true } } } } },
    });

    if (!cobranca) return notFoundError("Cobranca") as unknown as Response;
    if (cobranca.status === "paga" || cobranca.status === "cancelada") {
      return unprocessableError(`Cobranca already ${cobranca.status}`) as unknown as Response;
    }

    const responsavel = cobranca.unidade.vinculos.find(
      (v) => v.papel === "responsavel_financeiro" && v.ativo
    ) ?? cobranca.unidade.vinculos.find((v) => v.papel === "proprietario" && v.ativo);

    if (!responsavel) {
      return unprocessableError("No responsavel financeiro or proprietario found") as unknown as Response;
    }

    const pixParams: PixParams = {
      cobrancaId,
      valor: cobranca.valor,
      vencimento: cobranca.vencimento,
      devedor: { nome: responsavel.pessoa.nome, cpf: responsavel.pessoa.cpf },
      ...(cobranca.descricao !== null && cobranca.descricao !== undefined
        ? { descricao: cobranca.descricao }
        : {}),
    };

    const result = await paymentProvider.criarCobrancaPix(pixParams);

    const emissao = await db.cobrancaEmissao.create({
      data: {
        cobrancaId,
        metodo: "pix",
        externalId: result.externalId,
        payload: {
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          vencimento: result.vencimento.toISOString(),
        },
      },
    });

    return NextResponse.json(emissao, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
