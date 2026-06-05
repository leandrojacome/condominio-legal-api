import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";
import type { NextRequest } from "next/server";
import type { RouteContext } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";

const {
  mockGetAuthSession,
  mockCobrancaFindMany,
  mockCobrancaFindFirst,
  mockCondominioFindFirst,
} = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
  mockCobrancaFindMany: vi.fn(),
  mockCobrancaFindFirst: vi.fn(),
  mockCondominioFindFirst: vi.fn(),
}));

const mockTenantDb = {
  cobranca: {
    findMany: mockCobrancaFindMany,
    findFirst: mockCobrancaFindFirst,
  },
  condominio: { findFirst: mockCondominioFindFirst },
};

vi.mock("@/lib/auth", () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock("@/infrastructure/db/client", () => ({
  getPrismaWithTenant: vi.fn(() => mockTenantDb),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GET as listCobrancasGet } from "@/app/api/v1/financeiro/condominios/[id]/cobrancas/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GET as getCobrancaGet } from "@/app/api/v1/financeiro/condominios/[id]/cobrancas/[cobrancaId]/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GET as inadimplentesGet } from "@/app/api/v1/financeiro/condominios/[id]/inadimplentes/route";

const BASE_SESSION = {
  userId: "u-1",
  supabaseId: "sb-1",
  email: "user@test.com",
  name: "Test User",
  condominioId: "condo-1",
  perfil: PerfilUsuario.SINDICO,
  vinculoId: "v-1",
};

function makeReq(searchParams = new URLSearchParams("")): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer test-token" }),
    nextUrl: { searchParams },
  } as unknown as NextRequest;
}

function makeCtx(params: Record<string, string>): RouteContext {
  return { params: Promise.resolve(params) } as RouteContext;
}

describe("CODAA-212 — cobrança devedorId integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockGetAuthSession as MockInstance).mockResolvedValue(BASE_SESSION);
    (mockCobrancaFindMany as MockInstance).mockResolvedValue([]);
    (mockCobrancaFindFirst as MockInstance).mockResolvedValue({
      id: "cobr-1",
      devedorId: "vinc-1",
      devedor: { id: "vinc-1", condominioId: "condo-1" },
      status: "em_aberto",
      valor: 100,
      vencimento: new Date("2026-06-30T00:00:00.000Z"),
    });
    (mockCondominioFindFirst as MockInstance).mockResolvedValue({
      id: "condo-1",
      multaAtraso: 2,
      jurosMensal: 1,
    });
  });

  it("GET /cobrancas filters by devedorId and includes devedor", async () => {
    const sp = new URLSearchParams({ devedorId: "vinc-1" });

    await listCobrancasGet(makeReq(sp), makeCtx({ id: "condo-1" }));

    const call = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      include: Record<string, unknown>;
    };
    expect(call.where.devedorId).toBe("vinc-1");
    expect(call.include.devedor).toEqual({ include: { pessoa: true } });
  });

  it("GET /cobrancas rejects condominioId divergent from tenant before filtering devedorId", async () => {
    const sp = new URLSearchParams({ devedorId: "vinc-other-condo" });

    const res = (await listCobrancasGet(makeReq(sp), makeCtx({ id: "condo-2" }))) as Response;

    expect(res.status).toBe(403);
    expect(mockCobrancaFindMany).not.toHaveBeenCalled();
  });

  it("GET /cobrancas/{cobrancaId} includes devedor in the response", async () => {
    const res = (await getCobrancaGet(
      makeReq(),
      makeCtx({ id: "condo-1", cobrancaId: "cobr-1" })
    )) as Response;
    const body = (await res.json()) as { devedorId: string; devedor: { id: string } };

    const call = (mockCobrancaFindFirst as MockInstance).mock.calls[0]?.[0] as {
      include: Record<string, unknown>;
    };
    expect(call.include.devedor).toEqual({ include: { pessoa: true } });
    expect(body.devedorId).toBe("vinc-1");
    expect(body.devedor.id).toBe("vinc-1");
  });

  it("GET /inadimplentes filters overdue cobrancas by devedorId and includes devedor", async () => {
    const sp = new URLSearchParams({ devedorId: "vinc-1" });

    await inadimplentesGet(makeReq(sp), makeCtx({ id: "condo-1" }));

    const call = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      include: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({ status: "em_atraso", devedorId: "vinc-1" });
    expect(call.include.devedor).toEqual({ include: { pessoa: true } });
  });
});
