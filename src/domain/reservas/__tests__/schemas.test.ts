import { describe, it, expect } from "vitest";
import {
  CriarAreaComumSchema,
  CriarReservaSchema,
  AtualizarAreaComumSchema,
} from "../schemas";

describe("CriarAreaComumSchema", () => {
  const base = {
    nome: "Salão de Festas",
    granularidade: "dia_inteiro",
    politicaConflito: "exclusiva",
    modoAprovacao: "automatica",
  };

  it("accepts minimal valid area", () => {
    expect(CriarAreaComumSchema.safeParse(base).success).toBe(true);
  });

  it("accepts full area with optional fields", () => {
    const full = {
      ...base,
      capacidade: 50,
      antecedenciaMinimaHoras: 24,
      antecedenciaMaximaDias: 30,
      limiteReservasPorUnidade: 2,
      taxaUso: 100.0,
    };
    expect(CriarAreaComumSchema.safeParse(full).success).toBe(true);
  });

  it("rejects invalid granularidade", () => {
    expect(
      CriarAreaComumSchema.safeParse({ ...base, granularidade: "semana" }).success
    ).toBe(false);
  });

  it("rejects invalid politicaConflito", () => {
    expect(
      CriarAreaComumSchema.safeParse({ ...base, politicaConflito: "livre" }).success
    ).toBe(false);
  });

  it("rejects invalid modoAprovacao", () => {
    expect(
      CriarAreaComumSchema.safeParse({ ...base, modoAprovacao: "manual" }).success
    ).toBe(false);
  });

  it("rejects negative capacidade", () => {
    expect(
      CriarAreaComumSchema.safeParse({ ...base, capacidade: -1 }).success
    ).toBe(false);
  });

  it("rejects negative taxaUso", () => {
    expect(
      CriarAreaComumSchema.safeParse({ ...base, taxaUso: -10 }).success
    ).toBe(false);
  });

  it("rejects empty nome", () => {
    expect(
      CriarAreaComumSchema.safeParse({ ...base, nome: "" }).success
    ).toBe(false);
  });

  it("granularidade turno and horario are valid", () => {
    expect(CriarAreaComumSchema.safeParse({ ...base, granularidade: "turno" }).success).toBe(true);
    expect(CriarAreaComumSchema.safeParse({ ...base, granularidade: "horario" }).success).toBe(true);
  });

  it("modoAprovacao requer_aprovacao is valid", () => {
    expect(
      CriarAreaComumSchema.safeParse({ ...base, modoAprovacao: "requer_aprovacao" }).success
    ).toBe(true);
  });
});

describe("AtualizarAreaComumSchema", () => {
  it("accepts empty update", () => {
    expect(AtualizarAreaComumSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update", () => {
    expect(AtualizarAreaComumSchema.safeParse({ nome: "Churrasqueira", ativa: false }).success).toBe(true);
  });

  it("rejects invalid ativa type", () => {
    expect(AtualizarAreaComumSchema.safeParse({ ativa: "sim" }).success).toBe(false);
  });
});

describe("CriarReservaSchema", () => {
  const validCuid = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
  const base = {
    areaComumId: validCuid,
    inicio: "2026-06-10T10:00:00.000Z",
    fim: "2026-06-10T12:00:00.000Z",
  };

  it("accepts valid reserva", () => {
    expect(CriarReservaSchema.safeParse(base).success).toBe(true);
  });

  it("rejects invalid areaComumId (not cuid)", () => {
    expect(
      CriarReservaSchema.safeParse({ ...base, areaComumId: "not-a-cuid" }).success
    ).toBe(false);
  });

  it("rejects invalid inicio datetime", () => {
    expect(
      CriarReservaSchema.safeParse({ ...base, inicio: "10/06/2026" }).success
    ).toBe(false);
  });

  it("rejects missing fim", () => {
    const { fim: _fim, ...noFim } = base;
    expect(CriarReservaSchema.safeParse(noFim).success).toBe(false);
  });
});
