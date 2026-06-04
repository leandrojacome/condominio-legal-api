import { z } from "zod";

export const GranularidadeEnum = z.enum(["dia_inteiro", "turno", "horario"]);
export const PoliticaConflitoEnum = z.enum(["exclusiva", "capacidade"]);
export const ModoAprovacaoEnum = z.enum(["automatica", "requer_aprovacao"]);

export const CriarAreaComumSchema = z.object({
  nome: z.string().min(1).max(200),
  granularidade: GranularidadeEnum,
  politicaConflito: PoliticaConflitoEnum,
  capacidade: z.number().int().positive().optional(),
  modoAprovacao: ModoAprovacaoEnum,
  antecedenciaMinimaHoras: z.number().int().nonnegative().optional(),
  antecedenciaMaximaDias: z.number().int().positive().optional(),
  limiteReservasPorUnidade: z.number().int().positive().optional(),
  taxaUso: z.number().nonnegative().optional(),
});

export const AtualizarAreaComumSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  granularidade: GranularidadeEnum.optional(),
  politicaConflito: PoliticaConflitoEnum.optional(),
  capacidade: z.number().int().positive().optional(),
  modoAprovacao: ModoAprovacaoEnum.optional(),
  antecedenciaMinimaHoras: z.number().int().nonnegative().optional(),
  antecedenciaMaximaDias: z.number().int().positive().optional(),
  limiteReservasPorUnidade: z.number().int().positive().optional(),
  taxaUso: z.number().nonnegative().optional(),
  ativa: z.boolean().optional(),
});

export const CriarReservaSchema = z.object({
  areaComumId: z.string().cuid(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
});
