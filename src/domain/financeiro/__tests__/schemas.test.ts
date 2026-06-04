import { describe, it, expect } from "vitest";
import {
  CriarCobrancaSchema,
  RatearDespesaSchema,
} from "../schemas";

describe("CriarCobrancaSchema", () => {
  const base = {
    unidadeId: "cuid1234567890123456789",
    tipo: "taxa_mensal",
    valor: 500,
    competencia: "2026-06",
    vencimento: "2026-06-10T00:00:00.000Z",
  };

  it("accepts valid cobranca", () => {
    expect(CriarCobrancaSchema.safeParse(base).success).toBe(true);
  });

  it("rejects negative valor", () => {
    expect(CriarCobrancaSchema.safeParse({ ...base, valor: -1 }).success).toBe(false);
  });

  it("rejects invalid competencia format", () => {
    expect(
      CriarCobrancaSchema.safeParse({ ...base, competencia: "06-2026" }).success
    ).toBe(false);
  });

  it("rejects invalid tipo", () => {
    expect(
      CriarCobrancaSchema.safeParse({ ...base, tipo: "aluguel" }).success
    ).toBe(false);
  });
});

describe("RatearDespesaSchema", () => {
  const base = {
    valor: 1000,
    competencia: "2026-06",
    vencimento: "2026-06-10T00:00:00.000Z",
    criterio: "igual",
  };

  it("accepts equal rateio", () => {
    expect(RatearDespesaSchema.safeParse(base).success).toBe(true);
  });

  it("accepts fracao_ideal rateio", () => {
    expect(
      RatearDespesaSchema.safeParse({ ...base, criterio: "fracao_ideal" }).success
    ).toBe(true);
  });

  it("rejects invalid criterio", () => {
    expect(
      RatearDespesaSchema.safeParse({ ...base, criterio: "proporcional" }).success
    ).toBe(false);
  });
});
