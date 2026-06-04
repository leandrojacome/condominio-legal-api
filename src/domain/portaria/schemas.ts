import { z } from "zod";

export const TipoAcessoEnum = z.enum(["visitante", "prestador", "entrega", "veiculo"]);

export const StatusAcessoEnum = z.enum([
  "aguardando_confirmacao",
  "autorizado",
  "negado",
  "no_condominio",
  "encerrado",
]);

export const RegistrarAcessoSchema = z.object({
  tipo: TipoAcessoEnum,
  nomeVisitante: z.string().min(2).max(200),
  documento: z.string().max(30).optional(),
  unidadeDestinoId: z.string().cuid(),
  preAutorizacaoId: z.string().cuid().optional(),
});

export const PreAutorizarSchema = z.object({
  nomeVisitante: z.string().min(2).max(200),
  unidadeId: z.string().cuid(),
  validoAte: z.string().datetime(),
});

export const RegistrarEncomendaSchema = z.object({
  unidadeDestinoId: z.string().cuid(),
  remetente: z.string().max(200).optional(),
  fotoKey: z.string().max(500).optional(),
});

export const ConfirmarAcessoSchema = z.object({
  decisao: z.enum(["autorizar", "negar"]),
});

export const RegistrarSaidaSchema = z.object({
  acessoId: z.string().cuid(),
});

export const RegistrarRetiradaSchema = z.object({
  retiradorId: z.string().cuid().optional(),
});

export const ConsultarHistoricoQuerySchema = z.object({
  unidadeId: z.string().cuid().optional(),
  de: z.string().datetime().optional(),
  ate: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export type RegistrarAcessoInput = z.infer<typeof RegistrarAcessoSchema>;
export type PreAutorizarInput = z.infer<typeof PreAutorizarSchema>;
export type RegistrarEncomendaInput = z.infer<typeof RegistrarEncomendaSchema>;
export type ConfirmarAcessoInput = z.infer<typeof ConfirmarAcessoSchema>;
export type RegistrarRetiradaInput = z.infer<typeof RegistrarRetiradaSchema>;
export type ConsultarHistoricoQuery = z.infer<typeof ConsultarHistoricoQuerySchema>;
