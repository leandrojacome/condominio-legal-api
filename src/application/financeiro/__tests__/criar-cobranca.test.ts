/**
 * Unit tests for criarCobranca use-case (SPEC-3/Fix 10).
 * Covers: responsável_financeiro present, fallback to proprietário,
 * and absence of both (clear error).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

// ── Mock DB client ──────────────────────────────────────────────────────────
const mockFindFirstUnidade = vi.fn();
const mockFindFirstVinculo = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/infrastructure/db/client", () => ({
  getPrismaWithTenant: vi.fn(() => ({
    unidade: { findFirst: mockFindFirstUnidade },
    vinculo: { findFirst: mockFindFirstVinculo },
    cobranca: { create: mockCreate },
  })),
}));

import { criarCobranca } from "@/application/financeiro/use-cases/criar-cobranca";
import { AppError } from "@/lib/errors";

const BASE_INPUT = {
  condominioId: "condo-test",
  unidadeId: "unid-test",
  tipo: "taxa_mensal" as const,
  valor: 500,
  competencia: "2026-06",
  vencimento: new Date("2026-06-30"),
};

const MOCK_UNIDADE = { id: "unid-test", ativo: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirstUnidade.mockResolvedValue(MOCK_UNIDADE);
  mockCreate.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "cobr-1", ...args.data })
  );
});

describe("criarCobranca — responsavelId (SPEC-3)", () => {
  it("uses responsavel_financeiro vinculo as devedor and keeps legacy responsavelId", async () => {
    const financeiro = { id: "vinc-fin", userId: "user-fin", papel: "responsavel_financeiro" };
    // First call (responsavel_financeiro) returns the vinculo
    mockFindFirstVinculo.mockResolvedValueOnce(financeiro);

    const result = await criarCobranca(BASE_INPUT);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ devedorId: "vinc-fin", responsavelId: "user-fin" }),
      })
    );
    expect(result.devedorId).toBe("vinc-fin");
    expect(result.responsavelId).toBe("user-fin");
  });

  it("falls back to proprietario vinculo as devedor when no responsavel_financeiro exists", async () => {
    const proprietario = { id: "vinc-prop", userId: "user-prop", papel: "proprietario" };
    // First call (responsavel_financeiro) returns null, second (proprietario) returns the vinculo
    mockFindFirstVinculo
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(proprietario);

    const result = await criarCobranca(BASE_INPUT);

    expect(mockFindFirstVinculo).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ devedorId: "vinc-prop", responsavelId: "user-prop" }),
      })
    );
    expect(result.devedorId).toBe("vinc-prop");
    expect(result.responsavelId).toBe("user-prop");
  });

  it("throws UNPROCESSABLE when neither responsavel_financeiro nor proprietario exists", async () => {
    mockFindFirstVinculo.mockResolvedValue(null);

    await expect(criarCobranca(BASE_INPUT)).rejects.toThrow(AppError);
    await expect(criarCobranca(BASE_INPUT)).rejects.toMatchObject({
      code: "UNPROCESSABLE",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when unidade does not exist", async () => {
    mockFindFirstUnidade.mockResolvedValue(null);

    await expect(criarCobranca(BASE_INPUT)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockFindFirstVinculo).not.toHaveBeenCalled();
  });

  it("passes all other cobranca fields correctly", async () => {
    mockFindFirstVinculo.mockResolvedValueOnce({ id: "vinc-fin", userId: "user-fin" });

    await criarCobranca({ ...BASE_INPUT, descricao: "Taxa junho" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          condominioId: "condo-test",
          unidadeId: "unid-test",
          tipo: "taxa_mensal",
          valor: 500,
          competencia: "2026-06",
          descricao: "Taxa junho",
        }),
      })
    );
  });
});
