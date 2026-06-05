import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";
import type { NextRequest } from "next/server";
import type { RouteContext } from "@/lib/auth/rbac";
import { Prisma } from "@prisma/client";
import { PerfilUsuario } from "@/domain/cadastro/perfil";

const {
  mockGetAuthSession,
  mockGetTenantContext,
  mockIdempotencyRecordCreate,
  mockIdempotencyRecordFindUnique,
  mockIdempotencyRecordUpdate,
  mockRegistrarAcesso,
  mockRegistrarEncomenda,
  mockRegistrarVoto,
  mockCobrancaFindFirst,
  mockCobrancaEmissaoFindFirst,
  mockCobrancaEmissaoCreate,
  mockCriarCobrancaBoleto,
  mockCriarCobrancaPix,
} = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
  mockGetTenantContext: vi.fn(),
  mockIdempotencyRecordCreate: vi.fn(),
  mockIdempotencyRecordFindUnique: vi.fn(),
  mockIdempotencyRecordUpdate: vi.fn(),
  mockRegistrarAcesso: vi.fn(),
  mockRegistrarEncomenda: vi.fn(),
  mockRegistrarVoto: vi.fn(),
  mockCobrancaFindFirst: vi.fn(),
  mockCobrancaEmissaoFindFirst: vi.fn(),
  mockCobrancaEmissaoCreate: vi.fn(),
  mockCriarCobrancaBoleto: vi.fn(),
  mockCriarCobrancaPix: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock("@/lib/tenant", () => ({
  getTenantContext: mockGetTenantContext,
}));

vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    idempotencyRecord: {
      create: mockIdempotencyRecordCreate,
      findUnique: mockIdempotencyRecordFindUnique,
      update: mockIdempotencyRecordUpdate,
    },
  },
  getPrismaWithTenant: vi.fn(() => ({
    cobranca: { findFirst: mockCobrancaFindFirst },
    cobrancaEmissao: {
      findFirst: mockCobrancaEmissaoFindFirst,
      create: mockCobrancaEmissaoCreate,
    },
  })),
}));

vi.mock("@/application/portaria/use-cases/registrar-acesso", () => ({
  registrarAcesso: mockRegistrarAcesso,
}));

vi.mock("@/application/portaria/use-cases/registrar-encomenda", () => ({
  registrarEncomenda: mockRegistrarEncomenda,
}));

vi.mock("@/application/assembleias/use-cases/registrar-voto", () => ({
  registrarVoto: mockRegistrarVoto,
}));

vi.mock("@/infrastructure/payments/efi", () => ({
  paymentProvider: {
    criarCobrancaBoleto: mockCriarCobrancaBoleto,
    criarCobrancaPix: mockCriarCobrancaPix,
  },
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - bracketed route segments are valid in the Next.js app tree.
import { POST as acessosPost } from "@/app/api/v1/portaria/condominios/[id]/acessos/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - bracketed route segments are valid in the Next.js app tree.
import { POST as encomendasPost } from "@/app/api/v1/portaria/condominios/[id]/encomendas/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - bracketed route segments are valid in the Next.js app tree.
import { POST as votarPost } from "@/app/api/v1/assembleias/condominios/[id]/assembleias/[assembleiaId]/votar/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - bracketed route segments are valid in the Next.js app tree.
import { POST as emitirBoletoPost } from "@/app/api/v1/financeiro/condominios/[id]/cobrancas/[cobrancaId]/emitir-boleto/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - bracketed route segments are valid in the Next.js app tree.
import { POST as emitirPixPost } from "@/app/api/v1/financeiro/condominios/[id]/cobrancas/[cobrancaId]/emitir-pix/route";
import { hashCanonicalPayload } from "@/lib/idempotency";

const IDEMPOTENCY_KEY = "qa-idem-key-1";
const UNIDADE_ID = "clx0000000000000000000001";
const ITEM_PAUTA_ID = "clx0000000000000000000002";

type RouteCase = {
  name: string;
  scope: string;
  perfil: PerfilUsuario;
  call: (overrides?: {
    condominioId?: string;
    idempotencyKey?: string;
    body?: unknown;
    cobrancaId?: string;
  }) => Promise<Response>;
  body: unknown;
  sideEffect: MockInstance;
};

function makeReq(body: unknown = {}, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer supabase-token", ...headers }),
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

function makeCtx(params: Record<string, string>): RouteContext {
  return { params: Promise.resolve(params) } as RouteContext;
}

async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  return await res.json() as Record<string, unknown>;
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function setupSession(perfil: PerfilUsuario, condominioId = "condo-1"): void {
  const session = {
    userId: "user-1",
    condominioId,
    perfil,
  };
  mockGetAuthSession.mockResolvedValue(session);
  mockGetTenantContext.mockResolvedValue({
    userId: session.userId,
    condominioId,
  });
}

function setupSuccessfulDependencies(): void {
  mockRegistrarAcesso.mockResolvedValue({ id: "acesso-1", status: "aguardando_confirmacao" });
  mockRegistrarEncomenda.mockResolvedValue({ id: "encomenda-1", status: "recebida" });
  mockRegistrarVoto.mockResolvedValue({ id: "voto-1", opcao: "sim" });
  mockCobrancaFindFirst.mockResolvedValue({
    id: "cobranca-1",
    status: "aberta",
    valor: 100,
    vencimento: new Date("2026-06-30T00:00:00.000Z"),
    descricao: "Taxa condominial",
    devedor: { pessoa: { nome: "Responsavel", cpf: "12345678901" } },
    unidade: { vinculos: [] },
  });
  mockCobrancaEmissaoFindFirst.mockResolvedValue(null);
  mockCobrancaEmissaoCreate.mockImplementation(({ data }) => Promise.resolve({
    id: `emissao-${data.metodo}`,
    metodo: data.metodo,
    status: "emitido",
  }));
  mockCriarCobrancaBoleto.mockResolvedValue({
    externalId: "boleto-ext-1",
    linhaDigitavel: "linha",
    codigoBarras: "barras",
    dataVencimento: new Date("2026-06-30T00:00:00.000Z"),
  });
  mockCriarCobrancaPix.mockResolvedValue({
    externalId: "pix-ext-1",
    qrCode: "qr",
    qrCodeBase64: "base64",
    vencimento: new Date("2026-06-30T00:00:00.000Z"),
  });
}

function routeCases(): RouteCase[] {
  return [
    {
      name: "POST /api/v1/portaria/condominios/:id/acessos",
      scope: "portaria.acessos.create",
      perfil: PerfilUsuario.PORTEIRO,
      body: { tipo: "visitante", nomeVisitante: "Visitante QA", unidadeDestinoId: UNIDADE_ID },
      sideEffect: mockRegistrarAcesso,
      call: ({ condominioId = "condo-1", idempotencyKey, body } = {}) =>
        acessosPost(
          makeReq(body ?? { tipo: "visitante", nomeVisitante: "Visitante QA", unidadeDestinoId: UNIDADE_ID }, {
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          }),
          makeCtx({ id: condominioId })
        ),
    },
    {
      name: "POST /api/v1/portaria/condominios/:id/encomendas",
      scope: "portaria.encomendas.create",
      perfil: PerfilUsuario.PORTEIRO,
      body: { unidadeDestinoId: UNIDADE_ID, remetente: "QA" },
      sideEffect: mockRegistrarEncomenda,
      call: ({ condominioId = "condo-1", idempotencyKey, body } = {}) =>
        encomendasPost(
          makeReq(body ?? { unidadeDestinoId: UNIDADE_ID, remetente: "QA" }, {
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          }),
          makeCtx({ id: condominioId })
        ),
    },
    {
      name: "POST /api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/votar",
      scope: "assembleias.votos.cast",
      perfil: PerfilUsuario.SINDICO,
      body: { itemPautaId: ITEM_PAUTA_ID, opcao: "sim" },
      sideEffect: mockRegistrarVoto,
      call: ({ condominioId = "condo-1", idempotencyKey, body } = {}) =>
        votarPost(
          makeReq(body ?? { itemPautaId: ITEM_PAUTA_ID, opcao: "sim" }, {
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          }),
          makeCtx({ id: condominioId, assembleiaId: "assembleia-1" })
        ),
    },
    {
      name: "POST /api/v1/financeiro/condominios/:id/cobrancas/:cobrancaId/emitir-boleto",
      scope: "financeiro.boletos.emit",
      perfil: PerfilUsuario.SINDICO,
      body: {},
      sideEffect: mockCriarCobrancaBoleto,
      call: ({ condominioId = "condo-1", idempotencyKey, cobrancaId = "cobranca-1" } = {}) =>
        emitirBoletoPost(
          makeReq({}, {
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          }),
          makeCtx({ id: condominioId, cobrancaId })
        ),
    },
    {
      name: "POST /api/v1/financeiro/condominios/:id/cobrancas/:cobrancaId/emitir-pix",
      scope: "financeiro.pix.emit",
      perfil: PerfilUsuario.SINDICO,
      body: {},
      sideEffect: mockCriarCobrancaPix,
      call: ({ condominioId = "condo-1", idempotencyKey, cobrancaId = "cobranca-1" } = {}) =>
        emitirPixPost(
          makeReq({}, {
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          }),
          makeCtx({ id: condominioId, cobrancaId })
        ),
    },
  ];
}

describe("CODAA-287 persistent idempotency route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdempotencyRecordCreate.mockResolvedValue({});
    mockIdempotencyRecordUpdate.mockResolvedValue({});
    setupSuccessfulDependencies();
  });

  it.each(routeCases())(
    "AC1: $name rejects missing Idempotency-Key with 400 VALIDATION_ERROR",
    async (routeCase) => {
      setupSession(routeCase.perfil);

      const res = await routeCase.call();

      expect(res.status).toBe(400);
      await expect(jsonBody(res)).resolves.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Idempotency-Key header is required",
      });
      expect(mockIdempotencyRecordCreate).not.toHaveBeenCalled();
      expect(routeCase.sideEffect).not.toHaveBeenCalled();
    }
  );

  it.each(routeCases())(
    "AC2: $name reserves the key, executes once, and completes the response",
    async (routeCase) => {
      setupSession(routeCase.perfil);

      const res = await routeCase.call({ idempotencyKey: IDEMPOTENCY_KEY });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(mockIdempotencyRecordCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          condominioId: "condo-1",
          operationScope: routeCase.scope,
          idempotencyKey: IDEMPOTENCY_KEY,
          responseStatus: "pending",
        }),
      });
      expect(routeCase.sideEffect).toHaveBeenCalledTimes(1);
      expect(mockIdempotencyRecordUpdate).toHaveBeenCalledWith({
        where: {
          condominioId_operationScope_idempotencyKey: {
            condominioId: "condo-1",
            operationScope: routeCase.scope,
            idempotencyKey: IDEMPOTENCY_KEY,
          },
        },
        data: expect.objectContaining({
          responseStatus: "completed",
          statusCode: res.status,
        }),
      });
    }
  );

  it.each(routeCases())(
    "AC3: $name replays a completed same-key response without repeating the side effect",
    async (routeCase) => {
      setupSession(routeCase.perfil);
      mockIdempotencyRecordCreate.mockRejectedValue(uniqueConstraintError());
      mockIdempotencyRecordFindUnique.mockResolvedValue({
        requestHash: hashCanonicalPayload(
          routeCase.scope.startsWith("financeiro.")
            ? { condominioId: "condo-1", cobrancaId: "cobranca-1" }
            : routeCase.scope === "assembleias.votos.cast"
              ? { condominioId: "condo-1", assembleiaId: "assembleia-1", body: routeCase.body }
              : { condominioId: "condo-1", body: routeCase.body }
        ),
        responseStatus: "completed",
        statusCode: 201,
        responseHeaders: { "x-replayed": "true" },
        responseBody: { replayed: true },
      });

      const res = await routeCase.call({ idempotencyKey: IDEMPOTENCY_KEY });

      expect(res.status).toBe(201);
      expect(res.headers.get("Idempotency-Key")).toBe(IDEMPOTENCY_KEY);
      expect(res.headers.get("x-replayed")).toBe("true");
      await expect(jsonBody(res)).resolves.toEqual({ replayed: true });
      expect(routeCase.sideEffect).not.toHaveBeenCalled();
      expect(mockIdempotencyRecordUpdate).not.toHaveBeenCalled();
    }
  );

  it.each(routeCases())(
    "AC4: $name rejects same-key reuse with a different payload or route param",
    async (routeCase) => {
      setupSession(routeCase.perfil);
      mockIdempotencyRecordCreate.mockRejectedValue(uniqueConstraintError());
      mockIdempotencyRecordFindUnique.mockResolvedValue({
        requestHash: hashCanonicalPayload({ different: true }),
        responseStatus: "completed",
        statusCode: 201,
        responseHeaders: {},
        responseBody: { replayed: true },
      });

      const res = await routeCase.call({ idempotencyKey: IDEMPOTENCY_KEY });

      expect(res.status).toBe(409);
      await expect(jsonBody(res)).resolves.toMatchObject({
        code: "CONFLICT",
        message: "Idempotency-Key was already used with a different request payload",
      });
      expect(routeCase.sideEffect).not.toHaveBeenCalled();
    }
  );

  it("AC5: same key and scope in another condominium creates an independent record", async () => {
    const routeCase = routeCases().find((item) => item.scope === "portaria.encomendas.create");
    expect(routeCase).toBeDefined();
    if (!routeCase) return;

    setupSession(routeCase.perfil, "condo-1");
    await routeCase.call({ idempotencyKey: IDEMPOTENCY_KEY, condominioId: "condo-1" });

    setupSession(routeCase.perfil, "condo-2");
    await routeCase.call({ idempotencyKey: IDEMPOTENCY_KEY, condominioId: "condo-2" });

    expect(mockIdempotencyRecordCreate).toHaveBeenCalledTimes(2);
    expect(mockIdempotencyRecordCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        condominioId: "condo-1",
        operationScope: "portaria.encomendas.create",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    });
    expect(mockIdempotencyRecordCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        condominioId: "condo-2",
        operationScope: "portaria.encomendas.create",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    });
    expect(routeCase.sideEffect).toHaveBeenCalledTimes(2);
  });
});
