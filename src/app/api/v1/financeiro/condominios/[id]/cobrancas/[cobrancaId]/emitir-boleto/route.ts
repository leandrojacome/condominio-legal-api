import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { notFoundError, unprocessableError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { paymentProvider } from "@/infrastructure/payments/efi";
import type { BoletoParams } from "@/infrastructure/payments/provider";

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
      include: {
        devedor: { include: { pessoa: true } },
        unidade: { include: { vinculos: { include: { pessoa: true } } } },
      },
    });

    if (!cobranca) return notFoundError("Cobranca") as unknown as Response;
    if (cobranca.status === "paga" || cobranca.status === "cancelada") {
      return unprocessableError(`Cobranca already ${cobranca.status}`) as unknown as Response;
    }

    const responsavel = cobranca.devedor ?? cobranca.unidade.vinculos.find(
      (v) => v.papel === "responsavel_financeiro" && v.ativo
    ) ?? cobranca.unidade.vinculos.find((v) => v.papel === "proprietario" && v.ativo);

    if (!responsavel) {
      return unprocessableError("No responsavel financeiro or proprietario found") as unknown as Response;
    }

    const boletoParams: BoletoParams = {
      cobrancaId,
      valor: cobranca.valor,
      vencimento: cobranca.vencimento,
      devedor: { nome: responsavel.pessoa.nome, cpfCnpj: responsavel.pessoa.cpf },
      ...(cobranca.descricao !== null && cobranca.descricao !== undefined
        ? { descricao: cobranca.descricao }
        : {}),
    };

    const result = await paymentProvider.criarCobrancaBoleto(boletoParams);

    const emissao = await db.cobrancaEmissao.create({
      data: {
        cobrancaId,
        metodo: "boleto",
        externalId: result.externalId,
        payload: {
          linhaDigitavel: result.linhaDigitavel,
          codigoBarras: result.codigoBarras,
          dataVencimento: result.dataVencimento.toISOString(),
        },
      },
    });

    return NextResponse.json(emissao, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
