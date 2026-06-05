/**
 * Direct route handler tests for CODAA-119 security fixes.
 * 33 tests that import and invoke real route handlers / use cases, not simulations.
 *
 * C1  — PSP Webhook HMAC-SHA256 (6)
 * C2  — GET /condominios tenant scope (3)
 * M4  — confirmarAcesso vínculo guard (4)
 * M5  — avaliarOcorrencia author/gestor check (6)
 * M6a — StatusCobranca enum allowlist in GET /cobrancas (6)
 * M6b — TipoOcorrencia enum allowlist in GET /ocorrencias (8)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import crypto from "crypto";

// ─── Hoisted mock functions ────────────────────────────────────────────────────
const {
  mockGetAuthSession,
  mockCondominioFindMany,
  mockCobrancaFindMany,
  mockOcorrenciaFindMany,
  mockOcorrenciaFindFirst,
  mockVinculoFindFirst,
  mockRegistroAcessoFindFirst,
  mockRegistroAcessoUpdate,
  mockAvaliacaoCreate,
  mockCobrancaEmissaoFindUnique,
  mockPrismaTransaction,
} = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
  mockCondominioFindMany: vi.fn(),
  mockCobrancaFindMany: vi.fn(),
  mockOcorrenciaFindMany: vi.fn(),
  mockOcorrenciaFindFirst: vi.fn(),
  mockVinculoFindFirst: vi.fn(),
  mockRegistroAcessoFindFirst: vi.fn(),
  mockRegistroAcessoUpdate: vi.fn(),
  mockAvaliacaoCreate: vi.fn(),
  mockCobrancaEmissaoFindUnique: vi.fn(),
  mockPrismaTransaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: mockGetAuthSession,
  PerfilUsuario: {
    SINDICO: "sindico",
    ADMINISTRADORA: "administradora",
    PROPRIETARIO: "proprietario",
    INQUILINO: "inquilino",
    PORTEIRO: "porteiro",
    CONSELHO: "conselho",
  },
}));

const mockTenantDb = {
  condominio: { findMany: mockCondominioFindMany },
  cobranca: { findMany: mockCobrancaFindMany },
  ocorrencia: {
    findMany: mockOcorrenciaFindMany,
    findFirst: mockOcorrenciaFindFirst,
  },
  vinculo: { findFirst: mockVinculoFindFirst },
  registroAcesso: {
    findFirst: mockRegistroAcessoFindFirst,
    update: mockRegistroAcessoUpdate,
  },
  avaliacaoOcorrencia: { create: mockAvaliacaoCreate },
};

vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    cobrancaEmissao: { findUnique: mockCobrancaEmissaoFindUnique },
    $transaction: mockPrismaTransaction,
  },
  getPrismaWithTenant: vi.fn(() => mockTenantDb),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import type { NextRequest } from "next/server";
import type { RouteContext } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { POST as pspWebhookPost } from "@/app/api/webhooks/psp/route";
import { GET as condominiosGet } from "@/app/api/v1/cadastro/condominios/route";
import { confirmarAcesso } from "@/application/portaria/use-cases/confirmar-acesso";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path with brackets is valid in Next.js project structure
import { POST as avaliarPost } from "@/app/api/v1/ocorrencias/condominios/[id]/ocorrencias/[ocorrenciaId]/avaliar/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GET as cobrancasGet } from "@/app/api/v1/financeiro/condominios/[id]/cobrancas/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GET as ocorrenciasGet } from "@/app/api/v1/ocorrencias/condominios/[id]/ocorrencias/route";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function computeHmac(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function makePspReq(headers: Record<string, string>, textBody: string): NextRequest {
  return {
    headers: new Headers(headers),
    text: () => Promise.resolve(textBody),
  } as unknown as NextRequest;
}

function makeAuthReq(
  _condominioId = "condo-1",
  searchParams = new URLSearchParams(""),
  body: unknown = {}
): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer test-token" }),
    nextUrl: { searchParams },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

function makeCtx(params: Record<string, string>): RouteContext {
  return { params: Promise.resolve(params) } as RouteContext;
}

const BASE_SESSION = {
  userId: "u-1",
  supabaseId: "sb-1",
  email: "user@test.com",
  name: "Test User",
  condominioId: "condo-1",
  perfil: PerfilUsuario.SINDICO,
  vinculoId: "v-1",
};

// ─── C1 — PSP Webhook HMAC-SHA256 (6 tests) ──────────────────────────────────

describe("C1 — Webhook PSP: HMAC-SHA256 real POST handler", () => {
  const WEBHOOK_SECRET = "test-webhook-secret";
  const PIX_BODY = JSON.stringify({
    evento: "pix",
    pix: [{ endToEndId: "e2e-001", txid: "tx-001", valor: "250.00", horario: "2026-06-05T12:00:00Z" }],
  });
  const BOLETO_BODY = JSON.stringify({
    evento: "boleto",
    cobrancas: [{ nossoNumero: "00001", valor: 300, dataPagamento: "2026-06-05" }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["WEBHOOK_SECRET"] = WEBHOOK_SECRET;
    (mockCobrancaEmissaoFindUnique as MockInstance).mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env["WEBHOOK_SECRET"];
  });

  it("sig ausente → 401", async () => {
    const res = (await pspWebhookPost(makePspReq({}, PIX_BODY))) as Response;
    expect(res.status).toBe(401);
  });

  it("sig errada → 401", async () => {
    const res = (await pspWebhookPost(
      makePspReq({ "x-efipay-signature": "deadbeef00000000" }, PIX_BODY)
    )) as Response;
    expect(res.status).toBe(401);
  });

  it("WEBHOOK_SECRET não configurado → 401 sem bypass", async () => {
    delete process.env["WEBHOOK_SECRET"];
    const validSig = computeHmac(WEBHOOK_SECRET, PIX_BODY);
    const res = (await pspWebhookPost(
      makePspReq({ "x-efipay-signature": validSig }, PIX_BODY)
    )) as Response;
    expect(res.status).toBe(401);
  });

  it("sig válida + payload pix → 200", async () => {
    const sig = computeHmac(WEBHOOK_SECRET, PIX_BODY);
    const res = (await pspWebhookPost(
      makePspReq({ "x-efipay-signature": sig }, PIX_BODY)
    )) as Response;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: boolean };
    expect(body.received).toBe(true);
  });

  it("sig válida + payload boleto → 200", async () => {
    const sig = computeHmac(WEBHOOK_SECRET, BOLETO_BODY);
    const res = (await pspWebhookPost(
      makePspReq({ "x-efipay-signature": sig }, BOLETO_BODY)
    )) as Response;
    expect(res.status).toBe(200);
  });

  it("sig válida + payload sem campo evento → 400", async () => {
    const badBody = JSON.stringify({ missing_evento: true });
    const sig = computeHmac(WEBHOOK_SECRET, badBody);
    const res = (await pspWebhookPost(
      makePspReq({ "x-efipay-signature": sig }, badBody)
    )) as Response;
    expect(res.status).toBe(400);
  });
});

// ─── C2 — GET /condominios: tenant scope (3 tests) ───────────────────────────

describe("C2 — GET /condominios: tenant scope no handler real", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockCondominioFindMany as MockInstance).mockResolvedValue([]);
  });

  it("sem auth → 401", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue(null);
    const res = (await condominiosGet(makeAuthReq(), makeCtx({}))) as Response;
    expect(res.status).toBe(401);
  });

  it("session(condo-A) → findMany chamado com where contendo id: 'condo-A' (tenant context)", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      condominioId: "condo-A",
    });

    await condominiosGet(makeAuthReq("condo-A"), makeCtx({}));

    const call = (mockCondominioFindMany as MockInstance).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    // The where clause enforces condominioId scope — could be flat or wrapped in AND
    const whereStr = JSON.stringify(call?.where ?? {});
    expect(whereStr).toContain("condo-A");
  });

  it("session(condo-B) → findMany chamado com id: 'condo-B' (query diferente por tenant)", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      condominioId: "condo-B",
    });

    await condominiosGet(makeAuthReq("condo-B"), makeCtx({}));

    const call = (mockCondominioFindMany as MockInstance).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    const whereStr = JSON.stringify(call?.where ?? {});
    expect(whereStr).toContain("condo-B");
    // Ensures different tenant produces a different query from condo-A test
    expect(whereStr).not.toContain("condo-A");
  });
});

// ─── M4 — confirmarAcesso: vínculo guard (4 tests) ───────────────────────────
// confirmarAcesso(condominioId, confirmadorId, acessoId, input)

describe("M4 — confirmarAcesso: guarda de vínculo ativo na função real", () => {
  const BASE_ACESSO = {
    id: "acesso-1",
    status: "aguardando_confirmacao",
    unidadeDestinoId: "unidade-5",
    porteiroPorId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FORBIDDEN quando não há vínculo ativo (vinculo null)", async () => {
    (mockRegistroAcessoFindFirst as MockInstance).mockResolvedValue(BASE_ACESSO);
    (mockVinculoFindFirst as MockInstance).mockResolvedValue(null);

    await expect(
      confirmarAcesso("condo-1", "user-1", "acesso-1", { decisao: "autorizar" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("query de vínculo filtra confirmadorId(userId) + unidadeId(acesso.unidadeDestinoId) + ativo:true", async () => {
    (mockRegistroAcessoFindFirst as MockInstance).mockResolvedValue(BASE_ACESSO);
    (mockVinculoFindFirst as MockInstance).mockResolvedValue(null);

    // confirmadorId = "user-abc" (2nd arg), acessoId = "acesso-1" (3rd arg)
    await confirmarAcesso("condo-1", "user-abc", "acesso-1", { decisao: "autorizar" }).catch(() => {
      /* FORBIDDEN esperado */
    });

    expect(mockVinculoFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-abc", unidadeId: "unidade-5", ativo: true },
    });
  });

  it("sucesso com vínculo ativo → retorna registro atualizado", async () => {
    (mockRegistroAcessoFindFirst as MockInstance).mockResolvedValue(BASE_ACESSO);
    (mockVinculoFindFirst as MockInstance).mockResolvedValue({ id: "v-1", ativo: true });
    (mockRegistroAcessoUpdate as MockInstance).mockResolvedValue({
      ...BASE_ACESSO,
      status: "no_condominio",
    });

    const result = await confirmarAcesso("condo-1", "user-1", "acesso-1", { decisao: "autorizar" });
    expect(result).toMatchObject({ status: "no_condominio" });
  });

  it("status diferente de aguardando_confirmacao → UNPROCESSABLE", async () => {
    (mockRegistroAcessoFindFirst as MockInstance).mockResolvedValue({
      ...BASE_ACESSO,
      status: "no_condominio",
    });

    await expect(
      confirmarAcesso("condo-1", "user-1", "acesso-1", { decisao: "autorizar" })
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });
});

// ─── M5 — avaliarOcorrencia: author/gestor check (6 tests) ───────────────────

describe("M5 — POST avaliarOcorrencia: guarda author/gestor no handler real", () => {
  const CONDO = "condo-1";
  const OCORR_ID = "ocorr-1";
  const BASE_OCORRENCIA = {
    id: OCORR_ID,
    autorId: "u-author",
    encerradaEm: new Date("2026-06-01T10:00:00Z"),
  };
  const AVALIACAO_BODY = { classificacao: 4 };

  beforeEach(() => {
    vi.clearAllMocks();
    (mockOcorrenciaFindFirst as MockInstance).mockResolvedValue(BASE_OCORRENCIA);
    (mockAvaliacaoCreate as MockInstance).mockResolvedValue({ id: "aval-1", ocorrenciaId: OCORR_ID });
  });

  it("403 para inquilino que não é autor e não tem perfil gestor", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      userId: "u-inquilino",
      perfil: PerfilUsuario.INQUILINO,
      condominioId: CONDO,
    });
    (mockVinculoFindFirst as MockInstance).mockResolvedValue({ perfil: "inquilino" });

    const res = (await avaliarPost(
      makeAuthReq(CONDO, new URLSearchParams(""), AVALIACAO_BODY),
      makeCtx({ id: CONDO, ocorrenciaId: OCORR_ID })
    )) as Response;
    expect(res.status).toBe(403);
  });

  it("403 para proprietário que não é autor (proprietário não está em gestorPerfis)", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      userId: "u-prop",
      perfil: PerfilUsuario.PROPRIETARIO,
      condominioId: CONDO,
    });
    (mockVinculoFindFirst as MockInstance).mockResolvedValue({ perfil: "proprietario" });

    const res = (await avaliarPost(
      makeAuthReq(CONDO, new URLSearchParams(""), AVALIACAO_BODY),
      makeCtx({ id: CONDO, ocorrenciaId: OCORR_ID })
    )) as Response;
    expect(res.status).toBe(403);
  });

  it("201 para o autor da ocorrência (mesmo sem ser gestor)", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      userId: "u-author",
      perfil: PerfilUsuario.INQUILINO,
      condominioId: CONDO,
    });
    (mockVinculoFindFirst as MockInstance).mockResolvedValue({ perfil: "inquilino" });

    const res = (await avaliarPost(
      makeAuthReq(CONDO, new URLSearchParams(""), AVALIACAO_BODY),
      makeCtx({ id: CONDO, ocorrenciaId: OCORR_ID })
    )) as Response;
    expect(res.status).toBe(201);
  });

  it("201 para síndico (gestor — em gestorPerfis)", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      userId: "u-sindico",
      perfil: PerfilUsuario.SINDICO,
      condominioId: CONDO,
    });
    (mockVinculoFindFirst as MockInstance).mockResolvedValue({ perfil: "sindico" });

    const res = (await avaliarPost(
      makeAuthReq(CONDO, new URLSearchParams(""), AVALIACAO_BODY),
      makeCtx({ id: CONDO, ocorrenciaId: OCORR_ID })
    )) as Response;
    expect(res.status).toBe(201);
  });

  it("201 para administradora (gestor — em gestorPerfis)", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      userId: "u-adm",
      perfil: PerfilUsuario.ADMINISTRADORA,
      condominioId: CONDO,
    });
    (mockVinculoFindFirst as MockInstance).mockResolvedValue({ perfil: "administradora" });

    const res = (await avaliarPost(
      makeAuthReq(CONDO, new URLSearchParams(""), AVALIACAO_BODY),
      makeCtx({ id: CONDO, ocorrenciaId: OCORR_ID })
    )) as Response;
    expect(res.status).toBe(201);
  });

  it("201 para conselho (gestor — em gestorPerfis)", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      userId: "u-conselho",
      perfil: PerfilUsuario.CONSELHO,
      condominioId: CONDO,
    });
    (mockVinculoFindFirst as MockInstance).mockResolvedValue({ perfil: "conselho" });

    const res = (await avaliarPost(
      makeAuthReq(CONDO, new URLSearchParams(""), AVALIACAO_BODY),
      makeCtx({ id: CONDO, ocorrenciaId: OCORR_ID })
    )) as Response;
    expect(res.status).toBe(201);
  });
});

// ─── M6a — StatusCobranca: enum allowlist em GET /cobrancas (6 tests) ─────────

describe("M6a — GET /cobrancas: allowlist real de StatusCobranca", () => {
  const CONDO = "condo-1";

  beforeEach(() => {
    vi.clearAllMocks();
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      condominioId: CONDO,
      perfil: PerfilUsuario.SINDICO,
    });
    (mockCobrancaFindMany as MockInstance).mockResolvedValue([]);
  });

  function callCobrancas(status: string | null) {
    const sp = new URLSearchParams(status !== null ? { status } : {});
    return cobrancasGet(makeAuthReq(CONDO, sp), makeCtx({ id: CONDO })) as Promise<Response>;
  }

  it('"invalid_value" ignorado → findMany sem filtro status', async () => {
    await callCobrancas("invalid_value");
    const where = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.status).toBeUndefined();
  });

  it('"PAGA" (uppercase) ignorado → findMany sem filtro status', async () => {
    await callCobrancas("PAGA");
    const where = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.status).toBeUndefined();
  });

  it('"em_aberto" aceito → findMany com status: "em_aberto"', async () => {
    await callCobrancas("em_aberto");
    const where = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.status).toBe("em_aberto");
  });

  it('"em_atraso" aceito → findMany com status: "em_atraso"', async () => {
    await callCobrancas("em_atraso");
    const where = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.status).toBe("em_atraso");
  });

  it('"paga" aceito → findMany com status: "paga"', async () => {
    await callCobrancas("paga");
    const where = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.status).toBe("paga");
  });

  it('"cancelada" aceito → findMany com status: "cancelada"', async () => {
    await callCobrancas("cancelada");
    const where = (mockCobrancaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.status).toBe("cancelada");
  });
});

// ─── M6b — TipoOcorrencia: enum allowlist em GET /ocorrencias (8 tests) ───────

describe("M6b — GET /ocorrencias: allowlist real de TipoOcorrencia", () => {
  const CONDO = "condo-1";

  beforeEach(() => {
    vi.clearAllMocks();
    (mockGetAuthSession as MockInstance).mockResolvedValue({
      ...BASE_SESSION,
      condominioId: CONDO,
      perfil: PerfilUsuario.SINDICO,
    });
    (mockOcorrenciaFindMany as MockInstance).mockResolvedValue([]);
  });

  function callOcorrencias(tipo: string | null) {
    const sp = new URLSearchParams(tipo !== null ? { tipo } : {});
    return ocorrenciasGet(makeAuthReq(CONDO, sp), makeCtx({ id: CONDO })) as Promise<Response>;
  }

  it("sem parâmetro tipo → findMany sem filtro tipo", async () => {
    await callOcorrencias(null);
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBeUndefined();
  });

  it('"denuncia" (não está no enum) → findMany sem filtro tipo', async () => {
    await callOcorrencias("denuncia");
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBeUndefined();
  });

  it('"MANUTENCAO" (case incorreto) → findMany sem filtro tipo', async () => {
    await callOcorrencias("MANUTENCAO");
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBeUndefined();
  });

  it('"manutencao" aceito → findMany com tipo: "manutencao"', async () => {
    await callOcorrencias("manutencao");
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBe("manutencao");
  });

  it('"reclamacao" aceito → findMany com tipo: "reclamacao"', async () => {
    await callOcorrencias("reclamacao");
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBe("reclamacao");
  });

  it('"sugestao" aceito → findMany com tipo: "sugestao"', async () => {
    await callOcorrencias("sugestao");
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBe("sugestao");
  });

  it('"seguranca" aceito → findMany com tipo: "seguranca"', async () => {
    await callOcorrencias("seguranca");
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBe("seguranca");
  });

  it('"achados_perdidos" aceito → findMany com tipo: "achados_perdidos"', async () => {
    await callOcorrencias("achados_perdidos");
    const where = (mockOcorrenciaFindMany as MockInstance).mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.tipo).toBe("achados_perdidos");
  });
});
