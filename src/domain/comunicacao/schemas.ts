import { z } from "zod";

export const TipoComunicadoEnum = z.enum([
  "aviso_geral",
  "aviso_segmentado",
  "aviso_individual",
  "convocacao",
]);

export const CanalNotificacaoEnum = z.enum([
  "in_app",
  "email",
  "push",
  "sms_whatsapp",
]);

export const CriarComunicadoSchema = z.object({
  titulo: z.string().min(2).max(200),
  conteudo: z.string().min(1).max(10000),
  tipo: TipoComunicadoEnum,
  // For segmentado/individual: list of unidade IDs or user IDs
  destinatarioIds: z.array(z.string().cuid()).optional(),
  canais: z.array(CanalNotificacaoEnum).min(1).optional(),
});

export type CriarComunicadoData = z.infer<typeof CriarComunicadoSchema>;
