import { z } from "zod";

export const ModalidadeEnum = z.enum(["presencial", "online", "hibrida"]);

export const CriterioVotoEnum = z.enum(["por_unidade", "por_fracao"]);

export const OpcaoVotoEnum = z.enum(["sim", "nao", "abstencao"]);

export const CriarAssembleiaSchema = z.object({
  titulo: z.string().min(3).max(200),
  dataHora: z.string().datetime(),
  local: z.string().max(300).optional(),
  modalidade: ModalidadeEnum.optional(),
});

export const AdicionarItemPautaSchema = z.object({
  titulo: z.string().min(3).max(200),
  descricao: z.string().max(2000).optional(),
  criterioVoto: CriterioVotoEnum,
  quorumMinimo: z.number().min(0).max(100),
  votoSecreto: z.boolean().optional(),
  ordem: z.number().int().nonnegative(),
});

export const RegistrarVotoSchema = z.object({
  itemPautaId: z.string().cuid(),
  opcao: OpcaoVotoEnum,
});

export const EncerrarVotacaoSchema = z.object({});

export type CriarAssembleiaInput = z.infer<typeof CriarAssembleiaSchema>;
export type AdicionarItemPautaInput = z.infer<typeof AdicionarItemPautaSchema>;
export type RegistrarVotoInput = z.infer<typeof RegistrarVotoSchema>;
