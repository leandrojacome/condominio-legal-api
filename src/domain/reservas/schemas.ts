import { z } from "zod";

export const GranularidadeEnum = z.enum(["dia_inteiro", "turno", "horario"]);
export const PoliticaConflitoEnum = z.enum(["exclusiva", "capacidade"]);
export const ModoAprovacaoEnum = z.enum(["automatica", "requer_aprovacao"]);
export const StatusReservaEnum = z.enum(["pendente", "confirmada", "cancelada", "rejeitada"]);

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
  prazoCancelamentoHoras: z.number().int().nonnegative().optional(),
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
  prazoCancelamentoHoras: z.number().int().nonnegative().optional(),
  ativa: z.boolean().optional(),
});

export const CriarReservaSchema = z.object({
  areaComumId: z.string().cuid(),
  unidadeId: z.string().cuid().optional(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
});

export const AprovarReservaSchema = z.object({
  observacao: z.string().max(500).optional(),
});

export const RejeitarReservaSchema = z.object({
  motivo: z.string().min(1).max(500),
});

export const CancelarReservaSchema = z.object({
  motivo: z.string().max(500).optional(),
});

export type CriarAreaComumInput = z.infer<typeof CriarAreaComumSchema>;
export type AtualizarAreaComumInput = z.infer<typeof AtualizarAreaComumSchema>;
export type CriarReservaInput = z.infer<typeof CriarReservaSchema>;
export type AprovarReservaInput = z.infer<typeof AprovarReservaSchema>;
export type RejeitarReservaInput = z.infer<typeof RejeitarReservaSchema>;
export type CancelarReservaInput = z.infer<typeof CancelarReservaSchema>;
