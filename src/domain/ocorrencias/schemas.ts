import { z } from "zod";

// ─── Re-exported types used by existing use cases ────────────────────────────
// AbrirOcorrenciaData is an alias kept for backward compat
// (use-cases imported it before we renamed the schema)

// ─── Fluxo de Status ─────────────────────────────────────────────────────────

export const CriarFluxoStatusSchema = z.object({
  nome: z.string().min(1).max(60),
  descricao: z.string().max(255).optional(),
  inicial: z.boolean().optional(),
  terminal: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
});

export const ConfigurarFluxoSchema = z.object({
  statuses: z.array(CriarFluxoStatusSchema).min(1),
  transicoes: z.array(
    z.object({
      de: z.string().min(1),
      para: z.string().min(1),
    })
  ),
});

export type ConfigurarFluxoInput = z.infer<typeof ConfigurarFluxoSchema>;

// ─── Ocorrência ──────────────────────────────────────────────────────────────

export const TipoOcorrenciaEnum = z.enum([
  "manutencao",
  "reclamacao",
  "sugestao",
  "seguranca",
  "achados_perdidos",
]);

export const PrioridadeOcorrenciaEnum = z.enum(["baixa", "media", "alta"]);

export const AbrirOcorrenciaSchema = z.object({
  tipo: TipoOcorrenciaEnum,
  titulo: z.string().min(3).max(200),
  descricao: z.string().min(5).max(2000),
  unidadeId: z.string().cuid().optional(),
  prioridade: PrioridadeOcorrenciaEnum.optional(),
  slaHoras: z.number().int().positive().optional(),
});

export type AbrirOcorrenciaInput = z.infer<typeof AbrirOcorrenciaSchema>;
/** @deprecated alias kept for use-case backward compat */
export type AbrirOcorrenciaData = AbrirOcorrenciaInput;

export const AtribuirResponsavelSchema = z.object({
  responsavelId: z.string().min(1),
  prioridade: PrioridadeOcorrenciaEnum.optional(),
  slaHoras: z.number().int().positive().optional(),
});

export type AtribuirResponsavelInput = z.infer<typeof AtribuirResponsavelSchema>;

export const TransicionarStatusSchema = z.object({
  novoStatus: z.string().min(1).max(60),
  comentario: z.string().max(1000).optional(),
});

export type TransicionarStatusInput = z.infer<typeof TransicionarStatusSchema>;

// AtualizarStatusSchema — used by the status route and existing use-case
export const AtualizarStatusSchema = z.object({
  statusNovo: z.string().min(1).max(60),
  comentario: z.string().max(1000).optional(),
});

export type AtualizarStatusInput = z.infer<typeof AtualizarStatusSchema>;
/** @deprecated alias kept for use-case backward compat */
export type AtualizarStatusData = AtualizarStatusInput;

export const AdicionarComentarioSchema = z.object({
  comentario: z.string().min(1).max(2000),
});

export type AdicionarComentarioInput = z.infer<typeof AdicionarComentarioSchema>;

export const AvaliarOcorrenciaSchema = z.object({
  classificacao: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
});

export type AvaliarOcorrenciaInput = z.infer<typeof AvaliarOcorrenciaSchema>;

export const SolicitarAnexoSchema = z.object({
  nomeArquivo: z.string().min(1).max(255),
  contentType: z.string().regex(/^image\//, "Apenas imagens são permitidas").optional(),
});

export type SolicitarAnexoInput = z.infer<typeof SolicitarAnexoSchema>;

export const ListarOcorrenciasQuerySchema = z.object({
  tipo: TipoOcorrenciaEnum.optional(),
  status: z.string().optional(),
  slaEstourado: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined)),
});

// Compatibility alias
