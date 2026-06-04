import { z } from "zod";

// ─── Condomínio ───────────────────────────────────────────────────────────────

export const CriarCondominioSchema = z.object({
  nome: z.string().min(2).max(200),
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos"),
  endereco: z.string().min(5).max(500),
  multaAtraso: z.number().min(0).max(100).optional(),
  jurosMensal: z.number().min(0).max(100).optional(),
});

export const AtualizarCondominioSchema = CriarCondominioSchema.partial().omit({ cnpj: true });

// ─── Unidade ──────────────────────────────────────────────────────────────────

export const TipoUnidadeEnum = z.enum([
  "APARTAMENTO",
  "CASA",
  "COMERCIAL",
  "GARAGEM",
  "DEPOSITO",
]);

export const CriarUnidadeSchema = z.object({
  bloco: z.string().max(20).optional(),
  numero: z.string().min(1).max(20),
  tipo: TipoUnidadeEnum.optional(),
  fracaoIdeal: z.number().min(0).max(100).optional(),
});

export const AtualizarUnidadeSchema = CriarUnidadeSchema.partial();

// ─── Pessoa ───────────────────────────────────────────────────────────────────

export const CriarPessoaSchema = z.object({
  nome: z.string().min(2).max(200),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos"),
  email: z.string().email(),
  telefone: z.string().min(10).max(20),
});

export const AtualizarPessoaSchema = CriarPessoaSchema.partial().omit({ cpf: true });

// ─── Vínculo ─────────────────────────────────────────────────────────────────

export const PapelVinculoEnum = z.enum([
  "proprietario",
  "inquilino",
  "morador",
  "responsavel_financeiro",
  "imobiliaria",
]);

export const PerfilUsuarioEnum = z.enum([
  "sindico",
  "administradora",
  "proprietario",
  "inquilino",
  "porteiro",
  "conselho",
]);

export const CriarVinculoSchema = z.object({
  userId: z.string().cuid(),
  pessoaId: z.string().cuid(),
  unidadeId: z.string().cuid(),
  papel: PapelVinculoEnum,
  perfil: PerfilUsuarioEnum,
});
