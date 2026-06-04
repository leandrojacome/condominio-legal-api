import { z } from "zod";

export const ModalidadeEnum = z.enum(["presencial", "online", "hibrida"]);

export const CriterioVotoEnum = z.enum(["por_unidade", "por_fracao"]);

export const OpcaoVotoEnum = z.enum(["sim", "nao", "abstencao"]);

export const CanalNotificacaoEnum = z.enum(["in_app", "email", "push", "sms_whatsapp"]);

export const AdicionarItemPautaSchema = z.object({
  titulo: z.string().min(3).max(200),
  descricao: z.string().max(2000).optional(),
  criterioVoto: CriterioVotoEnum,
  quorumMinimo: z.number().min(0).max(100),
  votoSecreto: z.boolean().optional(),
  ordem: z.number().int().nonnegative(),
});

// Convocar assembleia requires at least one item de pauta (spec §Convocação exige ao menos um item de pauta)
export const ConvocarAssembleiaSchema = z.object({
  titulo: z.string().min(3).max(200),
  dataHora: z.string().datetime(),
  local: z.string().max(300).optional(),
  modalidade: ModalidadeEnum.optional(),
  itensPauta: z.array(AdicionarItemPautaSchema).min(1),
});

// Legacy schema kept for backward compat in tests
export const CriarAssembleiaSchema = z.object({
  titulo: z.string().min(3).max(200),
  dataHora: z.string().datetime(),
  local: z.string().max(300).optional(),
  modalidade: ModalidadeEnum.optional(),
});

export const RegistrarVotoSchema = z.object({
  itemPautaId: z.string().cuid(),
  opcao: OpcaoVotoEnum,
  // Optional: vote on behalf of another unit via procuração
  unidadeId: z.string().cuid().optional(),
});

export const EncerrarVotacaoSchema = z.object({});

export const AtualizarStatusAssembleiaSchema = z.object({
  status: z.enum(["em_votacao", "votacao_encerrada"]),
});

export const RegistrarProcuracaoSchema = z.object({
  unidadeRepresentadaId: z.string().cuid(),
  procuradorId: z.string().cuid(),
  validoAte: z.string().datetime(),
});

export const NotificarResultadoSchema = z.object({
  canais: z.array(CanalNotificacaoEnum).optional(),
});

export type CriarAssembleiaInput = z.infer<typeof CriarAssembleiaSchema>;
export type ConvocarAssembleiaInput = z.infer<typeof ConvocarAssembleiaSchema>;
export type AdicionarItemPautaInput = z.infer<typeof AdicionarItemPautaSchema>;
export type RegistrarVotoInput = z.infer<typeof RegistrarVotoSchema>;
export type RegistrarProcuracaoInput = z.infer<typeof RegistrarProcuracaoSchema>;
export type NotificarResultadoInput = z.infer<typeof NotificarResultadoSchema>;
