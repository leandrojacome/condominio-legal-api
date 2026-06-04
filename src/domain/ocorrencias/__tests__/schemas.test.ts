import { describe, it, expect } from "vitest";
import {
  AbrirOcorrenciaSchema,
  TransicionarStatusSchema,
  AvaliarOcorrenciaSchema,
  ConfigurarFluxoSchema,
  SolicitarAnexoSchema,
} from "../schemas";

describe("AbrirOcorrenciaSchema", () => {
  const base = {
    tipo: "manutencao",
    titulo: "Torneira com vazamento",
    descricao: "Torneira da cozinha com vazamento constante",
  };

  it("accepts valid ocorrencia", () =>
    expect(AbrirOcorrenciaSchema.safeParse(base).success).toBe(true));

  it("rejects invalid tipo", () =>
    expect(AbrirOcorrenciaSchema.safeParse({ ...base, tipo: "denuncia" }).success).toBe(false));

  it("rejects short titulo", () =>
    expect(AbrirOcorrenciaSchema.safeParse({ ...base, titulo: "ab" }).success).toBe(false));

  it("rejects short descricao", () =>
    expect(AbrirOcorrenciaSchema.safeParse({ ...base, descricao: "ok" }).success).toBe(false));

  it("accepts with prioridade alta", () =>
    expect(AbrirOcorrenciaSchema.safeParse({ ...base, prioridade: "alta" }).success).toBe(true));

  it("rejects invalid prioridade", () =>
    expect(AbrirOcorrenciaSchema.safeParse({ ...base, prioridade: "urgente" }).success).toBe(false));

  it("accepts all valid tipos", () => {
    for (const tipo of ["manutencao", "reclamacao", "sugestao", "seguranca", "achados_perdidos"]) {
      expect(AbrirOcorrenciaSchema.safeParse({ ...base, tipo }).success, `tipo=${tipo}`).toBe(true);
    }
  });
});

describe("TransicionarStatusSchema", () => {
  it("accepts novoStatus", () =>
    expect(TransicionarStatusSchema.safeParse({ novoStatus: "em_andamento" }).success).toBe(true));

  it("accepts novoStatus with comentario", () =>
    expect(
      TransicionarStatusSchema.safeParse({ novoStatus: "em_andamento", comentario: "Iniciando" }).success
    ).toBe(true));

  it("rejects empty novoStatus", () =>
    expect(TransicionarStatusSchema.safeParse({ novoStatus: "" }).success).toBe(false));
});

describe("AvaliarOcorrenciaSchema", () => {
  it("accepts valid avaliacao", () =>
    expect(AvaliarOcorrenciaSchema.safeParse({ classificacao: 4 }).success).toBe(true));

  it("rejects classificacao below 1", () =>
    expect(AvaliarOcorrenciaSchema.safeParse({ classificacao: 0 }).success).toBe(false));

  it("rejects classificacao above 5", () =>
    expect(AvaliarOcorrenciaSchema.safeParse({ classificacao: 6 }).success).toBe(false));
});

describe("ConfigurarFluxoSchema", () => {
  it("accepts valid flow config", () => {
    const result = ConfigurarFluxoSchema.safeParse({
      statuses: [
        { nome: "aberta", inicial: true },
        { nome: "em_andamento" },
        { nome: "resolvida", terminal: true },
      ],
      transicoes: [
        { de: "aberta", para: "em_andamento" },
        { de: "em_andamento", para: "resolvida" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty statuses array", () =>
    expect(ConfigurarFluxoSchema.safeParse({ statuses: [], transicoes: [] }).success).toBe(false));
});

describe("SolicitarAnexoSchema", () => {
  it("accepts image/jpeg", () =>
    expect(SolicitarAnexoSchema.safeParse({ nomeArquivo: "foto.jpg", contentType: "image/jpeg" }).success).toBe(true));

  it("rejects non-image content type", () =>
    expect(SolicitarAnexoSchema.safeParse({ nomeArquivo: "doc.pdf", contentType: "application/pdf" }).success).toBe(false));

  it("accepts without contentType", () =>
    expect(SolicitarAnexoSchema.safeParse({ nomeArquivo: "foto.png" }).success).toBe(true));
});
