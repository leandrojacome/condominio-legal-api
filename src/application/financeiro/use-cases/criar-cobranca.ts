import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { TipoCobranca } from "@prisma/client";

export interface CriarCobrancaInput {
  condominioId: string;
  unidadeId: string;
  tipo: TipoCobranca;
  valor: number;
  competencia: string;
  vencimento: Date;
  descricao?: string;
}

export async function criarCobranca(input: CriarCobrancaInput) {
  const db = getPrismaWithTenant(input.condominioId);

  const unidade = await db.unidade.findFirst({ where: { id: input.unidadeId } });
  if (!unidade) {
    throw new AppError("NOT_FOUND", "Unidade not found in this condominio");
  }

  // SPEC-3: responsável_financeiro com fallback para proprietário
  let vinculo = await db.vinculo.findFirst({
    where: { unidadeId: input.unidadeId, ativo: true, papel: "responsavel_financeiro" },
  });
  if (!vinculo) {
    vinculo = await db.vinculo.findFirst({
      where: { unidadeId: input.unidadeId, ativo: true, papel: "proprietario" },
    });
  }
  if (!vinculo) {
    throw new AppError(
      "UNPROCESSABLE",
      "Unidade has no active responsavel_financeiro or proprietario vinculo"
    );
  }

  const cobranca = await db.cobranca.create({
    data: {
      condominioId: input.condominioId,
      unidadeId: input.unidadeId,
      responsavelId: vinculo.userId,
      tipo: input.tipo,
      valor: input.valor,
      competencia: input.competencia,
      vencimento: input.vencimento,
      ...(input.descricao !== undefined && { descricao: input.descricao }),
    },
  });

  return cobranca;
}
