/**
 * Unit tests for ratearDespesa use-case (Módulo Financeiro, ARD §3.7).
 * Covers: rounding, last-unit absorption, fracao_ideal distribution,
 * and guard clauses for empty/missing fracao scenarios.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

// ── Mock DB client ──────────────────────────────────────────────────────────
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/infrastructure/db/client", () => ({
  getPrismaWithTenant: vi.fn(() => ({
    unidade: { findMany: mockFindMany },
    cobranca: { create: mockCreate },
    $transaction: mockTransaction,
  })),
}));

import { ratearDespesa } from "@/application/financeiro/use-cases/ratear-despesa";
import { AppError } from "@/lib/errors";

const BASE_INPUT = {
  condominioId: "condo-test",
  valor: 300,
  competencia: "2026-06",
  vencimento: new Date("2026-06-30"),
  criterio: "igual" as const,
};

describe("ratearDespesa — criterio: igual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction resolves each prisma.cobranca.create() in sequence
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops)
    );
    mockCreate.mockImplementation((args: { data: { valor: number } }) =>
      Promise.resolve({ id: "c-" + Math.random(), ...args.data })
    );
  });

  it("throws UNPROCESSABLE when there are no active unidades", async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(ratearDespesa(BASE_INPUT)).rejects.toThrow(AppError);
    await expect(ratearDespesa(BASE_INPUT)).rejects.toMatchObject({
      code: "UNPROCESSABLE",
    });
  });

  it("creates one cobranca per unidade with equal distribution", async () => {
    mockFindMany.mockResolvedValue([
      { id: "u1", fracaoIdeal: null },
      { id: "u2", fracaoIdeal: null },
      { id: "u3", fracaoIdeal: null },
    ]);

    const result = await ratearDespesa(BASE_INPUT);

    // 300 / 3 = 100 each
    expect(result.count).toBe(3);
    expect(mockCreate).toHaveBeenCalledTimes(3);
    const calls = (mockCreate as MockInstance).mock.calls as Array<[{ data: { valor: number } }]>;
    const valores = calls.map((c) => c[0].data.valor);
    expect(valores).toEqual([100, 100, 100]);
  });

  it("absorbs rounding remainder in the last unidade", async () => {
    // 10 / 3 = 3.33... — last unit gets the remainder
    mockFindMany.mockResolvedValue([
      { id: "u1", fracaoIdeal: null },
      { id: "u2", fracaoIdeal: null },
      { id: "u3", fracaoIdeal: null },
    ]);

    await ratearDespesa({ ...BASE_INPUT, valor: 10 });

    const calls = (mockCreate as MockInstance).mock.calls as Array<[{ data: { valor: number } }]>;
    const valores = calls.map((c) => c[0].data.valor);

    // First two get 3.33, last absorbs remainder → 3.34
    expect(valores[0]).toBeCloseTo(3.33, 2);
    expect(valores[1]).toBeCloseTo(3.33, 2);
    // Total must equal the original value
    const total = valores.reduce((a: number, b: number) => a + b, 0);
    expect(Math.round(total * 100) / 100).toBe(10);
  });

  it("stamps all cobrancas with the same loteRateioId", async () => {
    mockFindMany.mockResolvedValue([
      { id: "u1", fracaoIdeal: null },
      { id: "u2", fracaoIdeal: null },
    ]);

    const result = await ratearDespesa(BASE_INPUT);
    const calls = (mockCreate as MockInstance).mock.calls as Array<[{ data: { loteRateioId: string } }]>;
    const loteIds = calls.map((c) => c[0].data.loteRateioId);

    expect(loteIds[0]).toBe(loteIds[1]);
    expect(loteIds[0]).toBe(result.loteRateioId);
  });

  it("sets criterioRateio=igual on all cobrancas", async () => {
    mockFindMany.mockResolvedValue([{ id: "u1", fracaoIdeal: null }]);

    await ratearDespesa(BASE_INPUT);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ criterioRateio: "igual" }),
      })
    );
  });
});

describe("ratearDespesa — criterio: fracao_ideal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops)
    );
    mockCreate.mockImplementation((args: { data: { valor: number } }) =>
      Promise.resolve({ id: "c-" + Math.random(), ...args.data })
    );
  });

  it("throws UNPROCESSABLE when all fracaoIdeal are null/zero", async () => {
    mockFindMany.mockResolvedValue([
      { id: "u1", fracaoIdeal: 0 },
      { id: "u2", fracaoIdeal: null },
    ]);

    await expect(
      ratearDespesa({ ...BASE_INPUT, criterio: "fracao_ideal" })
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("distributes proportionally to fracaoIdeal", async () => {
    // u1 = 25%, u2 = 75% → 300 * 0.25 = 75, 300 * 0.75 = 225
    mockFindMany.mockResolvedValue([
      { id: "u1", fracaoIdeal: 0.25 },
      { id: "u2", fracaoIdeal: 0.75 },
    ]);

    await ratearDespesa({ ...BASE_INPUT, criterio: "fracao_ideal" });

    const calls = (mockCreate as MockInstance).mock.calls as Array<[{ data: { valor: number } }]>;
    const valores = calls.map((c) => c[0].data.valor);
    expect(valores[0]).toBeCloseTo(75, 1);
    expect(valores[1]).toBeCloseTo(225, 1);
  });

  it("sets criterioRateio=fracao_ideal on all cobrancas", async () => {
    mockFindMany.mockResolvedValue([{ id: "u1", fracaoIdeal: 1 }]);

    await ratearDespesa({ ...BASE_INPUT, criterio: "fracao_ideal" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ criterioRateio: "fracao_ideal" }),
      })
    );
  });
});
