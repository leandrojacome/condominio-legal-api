import { z } from "zod";

const COMPETENCIA_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const TipoCobrancaEnum = z.enum([
  "taxa_mensal",
  "fundo_reserva",
  "extra_rateio",
  "multa_juros",
  "consumo",
]);

export const CriarCobrancaSchema = z.object({
  unidadeId: z.string().cuid(),
  tipo: TipoCobrancaEnum,
  valor: z.number().positive(),
  competencia: z.string().regex(COMPETENCIA_REGEX, "Competência deve ser YYYY-MM"),
  vencimento: z.string().datetime(),
  descricao: z.string().max(500).optional(),
});

export const CriterioRateioEnum = z.enum(["fracao_ideal", "igual"]);

export const RatearDespesaSchema = z.object({
  valor: z.number().positive(),
  competencia: z.string().regex(COMPETENCIA_REGEX),
  vencimento: z.string().datetime(),
  criterio: CriterioRateioEnum,
  descricao: z.string().max(500).optional(),
});

export const AtualizarCobrancaSchema = z.object({
  descricao: z.string().max(500).optional(),
  vencimento: z.string().datetime().optional(),
});
