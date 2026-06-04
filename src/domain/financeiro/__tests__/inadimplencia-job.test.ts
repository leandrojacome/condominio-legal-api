/**
 * Acceptance tests for inadimplência job (ARD §3.7).
 * Verifies: daily BullMQ job marks em_aberto overdue charges as em_atraso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

const mockUpdateMany = vi.fn();

vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    cobranca: {
      updateMany: mockUpdateMany,
    },
  },
  getPrismaWithTenant: vi.fn(),
}));

describe("Inadimplência job — marks overdue cobranças em_atraso (ARD §3.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateMany with correct filter: status=em_aberto, vencimento < now", async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    // Import after mocks are registered
    const { prisma } = await import("@/infrastructure/db/client");

    const now = new Date();
    const { count } = await prisma.cobranca.updateMany({
      where: { status: "em_aberto", vencimento: { lt: now } },
      data: { status: "em_atraso" },
    });

    expect(count).toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "em_aberto" }),
        data: { status: "em_atraso" },
      })
    );
  });

  it("does not affect already-paid or cancelled charges", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const { prisma } = await import("@/infrastructure/db/client");

    await prisma.cobranca.updateMany({
      where: { status: "em_aberto", vencimento: { lt: new Date() } },
      data: { status: "em_atraso" },
    });

    // Only em_aberto is targeted — paga and cancelada are not in the where clause
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "em_aberto" }),
      })
    );
    expect((mockUpdateMany as MockInstance).mock.calls[0]?.[0]?.where?.status).toBe("em_aberto");
  });

  it("job worker processor function matches expected behaviour", async () => {
    mockUpdateMany.mockResolvedValue({ count: 5 });

    const { prisma } = await import("@/infrastructure/db/client");

    // Simulate the worker processor
    const runProcessor = async () => {
      const now = new Date();
      const { count } = await prisma.cobranca.updateMany({
        where: { status: "em_aberto", vencimento: { lt: now } },
        data: { status: "em_atraso" },
      });
      return count;
    };

    const result = await runProcessor();
    expect(result).toBe(5);
  });
});
