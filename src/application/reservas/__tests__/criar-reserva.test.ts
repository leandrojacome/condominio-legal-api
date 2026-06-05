/**
 * Unit tests for criarReserva use-case (Módulo Reservas, ARD §3.5).
 * Covers: time validation, inadimplência gate, antecedência, conflict policy,
 * capacity policy, and limit-per-unidade enforcement.
 * All DB calls mocked — no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

// ── Mock Prisma clients ────────────────────────────────────────────────────
const {
  mockTenantVinculoFindFirst,
  mockTenantCobrancaFindFirst,
  mockTenantAreaComumFindFirst,
  mockTenantReservaCount,
  mockGlobalTransaction,
  mockTxQueryRaw,
  mockTxReservaFindMany,
  mockTxReservaCreate,
  mockTxReservaUpdate,
  mockTxCobrancaCreate,
} = vi.hoisted(() => ({
  mockTenantVinculoFindFirst: vi.fn(),
  mockTenantCobrancaFindFirst: vi.fn(),
  mockTenantAreaComumFindFirst: vi.fn(),
  mockTenantReservaCount: vi.fn(),
  mockGlobalTransaction: vi.fn(),
  mockTxQueryRaw: vi.fn().mockResolvedValue(undefined),
  mockTxReservaFindMany: vi.fn(),
  mockTxReservaCreate: vi.fn(),
  mockTxReservaUpdate: vi.fn(),
  mockTxCobrancaCreate: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    $transaction: mockGlobalTransaction,
  },
  getPrismaWithTenant: vi.fn(() => ({
    vinculo: { findFirst: mockTenantVinculoFindFirst },
    cobranca: { findFirst: mockTenantCobrancaFindFirst },
    areaComum: { findFirst: mockTenantAreaComumFindFirst },
    reserva: { count: mockTenantReservaCount },
  })),
}));

import { criarReserva } from "@/application/reservas/use-cases/criar-reserva";
import { AppError } from "@/lib/errors";

// ── Shared fixtures ────────────────────────────────────────────────────────

const now = new Date();
// Bookings 5 hours from now to 7 hours from now
const INICIO = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
const FIM = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString();

const AREA_EXCLUSIVA = {
  id: "area-1",
  nome: "Salão de Festas",
  ativa: true,
  capacidade: 1,
  antecedenciaMinimaHoras: 2,
  antecedenciaMaximaDias: 30,
  limiteReservasPorUnidade: 3,
  politicaConflito: "exclusiva",
  modoAprovacao: "automatica",
  taxaUso: 0,
};

const VALID_VINCULO = {
  id: "vinculo-1",
  userId: "user-1",
  condominioId: "condo-1",
  unidadeId: "unidade-1",
  ativo: true,
};

const BASE_INPUT = {
  condominioId: "condo-1",
  userId: "user-1",
  areaComumId: "area-1",
  inicio: INICIO,
  fim: FIM,
};

function setupHappyPath() {
  mockTenantVinculoFindFirst.mockResolvedValue(VALID_VINCULO);
  mockTenantCobrancaFindFirst.mockResolvedValue(null);
  mockTenantAreaComumFindFirst.mockResolvedValue(AREA_EXCLUSIVA);
  mockTenantReservaCount.mockResolvedValue(0);
  mockGlobalTransaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: mockTxQueryRaw,
        reserva: {
          findMany: mockTxReservaFindMany,
          create: mockTxReservaCreate,
          update: mockTxReservaUpdate,
        },
        cobranca: { create: mockTxCobrancaCreate },
      })
  );
  mockTxReservaFindMany.mockResolvedValue([]);
  mockTxReservaCreate.mockResolvedValue({ id: "reserva-new", status: "confirmada", cobrancaId: null });
}

describe("criarReserva — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws VALIDATION_ERROR when fim is before or equal to inicio", async () => {
    await expect(
      criarReserva({ ...BASE_INPUT, inicio: FIM, fim: INICIO })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when fim equals inicio", async () => {
    await expect(
      criarReserva({ ...BASE_INPUT, inicio: INICIO, fim: INICIO })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("criarReserva — vínculo gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws FORBIDDEN when user has no active vínculo in this condominio", async () => {
    mockTenantVinculoFindFirst.mockResolvedValue(null);

    await expect(criarReserva(BASE_INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("criarReserva — inadimplência gate (ARD §5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws UNPROCESSABLE when unidade has an overdue cobranca", async () => {
    mockTenantVinculoFindFirst.mockResolvedValue(VALID_VINCULO);
    mockTenantCobrancaFindFirst.mockResolvedValue({ id: "cobr-late", status: "em_atraso" });

    await expect(criarReserva(BASE_INPUT)).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });
});

describe("criarReserva — antecedência", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws UNPROCESSABLE when booking start is below minimum advance", async () => {
    mockTenantVinculoFindFirst.mockResolvedValue(VALID_VINCULO);
    mockTenantCobrancaFindFirst.mockResolvedValue(null);
    // Area requires 10h minimum but booking starts in 5h
    mockTenantAreaComumFindFirst.mockResolvedValue({
      ...AREA_EXCLUSIVA,
      antecedenciaMinimaHoras: 10,
    });

    await expect(criarReserva(BASE_INPUT)).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("throws UNPROCESSABLE when booking start exceeds maximum advance days", async () => {
    mockTenantVinculoFindFirst.mockResolvedValue(VALID_VINCULO);
    mockTenantCobrancaFindFirst.mockResolvedValue(null);
    // Area allows max 1 day in advance but booking is 30 days out
    const far = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const farEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();
    mockTenantAreaComumFindFirst.mockResolvedValue({
      ...AREA_EXCLUSIVA,
      antecedenciaMaximaDias: 1,
      antecedenciaMinimaHoras: 0,
    });

    await expect(
      criarReserva({ ...BASE_INPUT, inicio: far, fim: farEnd })
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });
});

describe("criarReserva — limite por unidade", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws UNPROCESSABLE when unidade has reached the monthly limit", async () => {
    mockTenantVinculoFindFirst.mockResolvedValue(VALID_VINCULO);
    mockTenantCobrancaFindFirst.mockResolvedValue(null);
    mockTenantAreaComumFindFirst.mockResolvedValue({
      ...AREA_EXCLUSIVA,
      limiteReservasPorUnidade: 1,
    });
    mockTenantReservaCount.mockResolvedValue(1); // already at limit

    await expect(criarReserva(BASE_INPUT)).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });
});

describe("criarReserva — conflict policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws CONFLICT on overlap when politicaConflito=exclusiva", async () => {
    setupHappyPath();
    mockTxReservaFindMany.mockResolvedValue([{ id: "existing-reserva" }]);

    await expect(criarReserva(BASE_INPUT)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws CONFLICT when politicaConflito=capacidade and capacity is full", async () => {
    mockTenantVinculoFindFirst.mockResolvedValue(VALID_VINCULO);
    mockTenantCobrancaFindFirst.mockResolvedValue(null);
    mockTenantAreaComumFindFirst.mockResolvedValue({
      ...AREA_EXCLUSIVA,
      politicaConflito: "capacidade",
      capacidade: 2,
    });
    mockTenantReservaCount.mockResolvedValue(0);
    mockGlobalTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: mockTxQueryRaw,
          reserva: {
            findMany: vi.fn().mockResolvedValue([{ id: "r1" }, { id: "r2" }]), // 2 = capacity
            create: mockTxReservaCreate,
            update: mockTxReservaUpdate,
          },
          cobranca: { create: mockTxCobrancaCreate },
        })
    );

    await expect(criarReserva(BASE_INPUT)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows booking when overlap exists but politicaConflito=capacidade and capacity not full", async () => {
    mockTenantVinculoFindFirst.mockResolvedValue(VALID_VINCULO);
    mockTenantCobrancaFindFirst.mockResolvedValue(null);
    mockTenantAreaComumFindFirst.mockResolvedValue({
      ...AREA_EXCLUSIVA,
      politicaConflito: "capacidade",
      capacidade: 3,
    });
    mockTenantReservaCount.mockResolvedValue(0);
    mockGlobalTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: mockTxQueryRaw,
          reserva: {
            findMany: vi.fn().mockResolvedValue([{ id: "r1" }]), // 1 < capacity 3
            create: vi.fn().mockResolvedValue({ id: "reserva-new", status: "confirmada", cobrancaId: null }),
            update: mockTxReservaUpdate,
          },
          cobranca: { create: mockTxCobrancaCreate },
        })
    );

    const result = await criarReserva(BASE_INPUT);
    expect(result.id).toBe("reserva-new");
  });
});

describe("criarReserva — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("returns a reserva with status=confirmada when modoAprovacao=automatica", async () => {
    const result = await criarReserva(BASE_INPUT);
    expect(result.id).toBe("reserva-new");
    expect(result.status).toBe("confirmada");
  });

  it("returns a reserva with status=pendente when modoAprovacao=requer_aprovacao", async () => {
    mockTenantAreaComumFindFirst.mockResolvedValue({
      ...AREA_EXCLUSIVA,
      modoAprovacao: "requer_aprovacao",
    });
    mockTxReservaCreate.mockResolvedValue({ id: "reserva-pend", status: "pendente", cobrancaId: null });

    const result = await criarReserva(BASE_INPUT);
    expect(result.status).toBe("pendente");
  });

  it("creates a cobranca when area has taxaUso and reservation is confirmed", async () => {
    mockTenantAreaComumFindFirst.mockResolvedValue({
      ...AREA_EXCLUSIVA,
      taxaUso: 150,
    });
    mockTxReservaCreate.mockResolvedValue({ id: "reserva-taxa", status: "confirmada", cobrancaId: null });
    mockTxCobrancaCreate.mockResolvedValue({ id: "cobr-taxa" });
    mockTxReservaUpdate.mockResolvedValue({ id: "reserva-taxa", status: "confirmada", cobrancaId: "cobr-taxa" });

    await criarReserva(BASE_INPUT);

    expect(mockTxCobrancaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ valor: 150, tipo: "consumo" }),
      })
    );
  });

  it("does not create a cobranca when taxaUso is 0", async () => {
    // AREA_EXCLUSIVA already has taxaUso: 0
    await criarReserva(BASE_INPUT);
    expect(mockTxCobrancaCreate).not.toHaveBeenCalled();
  });
});
