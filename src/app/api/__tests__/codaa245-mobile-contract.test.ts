import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";
import type { NextRequest } from "next/server";
import type { RouteContext } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";

const {
  mockGetAuthSession,
  mockVinculoFindMany,
  mockVinculoFindFirst,
  mockUserUpdate,
  mockGeneratePresignedUploadUrl,
  mockBuildFotoKey,
} = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
  mockVinculoFindMany: vi.fn(),
  mockVinculoFindFirst: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockGeneratePresignedUploadUrl: vi.fn(),
  mockBuildFotoKey: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    vinculo: {
      findMany: mockVinculoFindMany,
      findFirst: mockVinculoFindFirst,
    },
    user: {
      update: mockUserUpdate,
    },
  },
  getPrismaWithTenant: vi.fn(() => ({
    cobranca: { findFirst: vi.fn() },
    cobrancaEmissao: { findFirst: vi.fn(), create: vi.fn() },
  })),
}));

vi.mock("@/infrastructure/storage/s3", () => ({
  generatePresignedUploadUrl: mockGeneratePresignedUploadUrl,
  buildFotoKey: mockBuildFotoKey,
}));

vi.mock("@/infrastructure/payments/efi", () => ({
  paymentProvider: {
    criarCobrancaBoleto: vi.fn(),
    criarCobrancaPix: vi.fn(),
  },
}));

import { GET as authCondominiosGet } from "@/app/api/v1/auth/condominios/route";
import { POST as selecionarCondominioPost } from "@/app/api/v1/auth/condominios/selecionar/route";
import {
  PUT as deviceTokenPut,
  DELETE as deviceTokenDelete,
} from "@/app/api/v1/auth/device-token/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - bracketed route segments are valid in the Next.js app tree.
import { POST as fotoUploadPost } from "@/app/api/v1/portaria/condominios/[id]/encomendas/foto-upload/route";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - bracketed route segments are valid in the Next.js app tree.
import { POST as emitirBoletoPost } from "@/app/api/v1/financeiro/condominios/[id]/cobrancas/[cobrancaId]/emitir-boleto/route";

const BASE_SESSION = {
  userId: "user-1",
  supabaseId: "supabase-1",
  email: "qa@example.com",
  name: "QA User",
  condominioId: "condo-1",
  perfil: PerfilUsuario.SINDICO,
  vinculoId: "clx0000000000000000000000",
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

describe("CODAA-245 mobile backend contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockGetAuthSession as MockInstance).mockResolvedValue(BASE_SESSION);
  });

  it("GET /api/v1/auth/condominios rejects missing Supabase Bearer with 401 error envelope", async () => {
    (mockGetAuthSession as MockInstance).mockResolvedValue(null);

    const res = await authCondominiosGet(makeReq());

    expect(res.status).toBe(401);
    await expect(jsonBody(res)).resolves.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  });

  it("GET /api/v1/auth/condominios returns active user vínculos and active context", async () => {
    (mockVinculoFindMany as MockInstance).mockResolvedValue([
      {
        id: "clx0000000000000000000000",
        condominioId: "condo-1",
        perfil: "sindico",
        papel: "proprietario",
        unidadeId: "unidade-1",
        condominio: { id: "condo-1", nome: "Residencial QA", cnpj: "00", endereco: "Rua QA" },
        unidade: { id: "unidade-1", bloco: "A", numero: "101", tipo: "apartamento" },
      },
    ]);

    const res = await authCondominiosGet(makeReq());

    expect(res.status).toBe(200);
    expect(mockVinculoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", ativo: true },
    }));
    await expect(jsonBody(res)).resolves.toMatchObject({
      activeVinculoId: "clx0000000000000000000000",
      activeCondominioId: "condo-1",
      vinculos: [
        {
          id: "clx0000000000000000000000",
          condominioId: "condo-1",
          perfil: "sindico",
        },
      ],
    });
  });

  it("POST /api/v1/auth/condominios/selecionar returns 403 when vínculo is not owned by user", async () => {
    (mockVinculoFindFirst as MockInstance).mockResolvedValue(null);

    const res = await selecionarCondominioPost(
      makeReq({ vinculoId: "clx0000000000000000000001" })
    );

    expect(res.status).toBe(403);
    expect(mockVinculoFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "clx0000000000000000000001",
        userId: "user-1",
        ativo: true,
      },
    }));
    await expect(jsonBody(res)).resolves.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("PUT and DELETE /api/v1/auth/device-token persist and remove the active device token", async () => {
    (mockUserUpdate as MockInstance).mockResolvedValue({});

    const putRes = await deviceTokenPut(
      makeReq({ token: "fcm-token-123456", provider: "fcm", platform: "android" })
    );
    const deleteRes = await deviceTokenDelete(makeReq());

    expect(putRes.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "user-1" },
      data: { fcmToken: "fcm-token-123456" },
    });
    await expect(jsonBody(putRes)).resolves.toMatchObject({
      registered: true,
      provider: "fcm",
      platform: "android",
      tokenLast4: "3456",
      deepLinks: expect.objectContaining({
        comunicado: expect.stringContaining("condominiolegal://"),
        cobranca: expect.stringContaining("condominiolegal://"),
        acesso: expect.stringContaining("condominiolegal://"),
        encomenda: expect.stringContaining("condominiolegal://"),
      }),
    });

    expect(deleteRes.status).toBe(204);
    expect(mockUserUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "user-1" },
      data: { fcmToken: null },
    });
  });

  it("tenant-scoped sensitive routes reject missing Idempotency-Key with 400 error envelope", async () => {
    const res = await emitirBoletoPost(
      makeReq(),
      makeCtx({ id: "condo-1", cobrancaId: "cobranca-1" })
    );

    expect(res.status).toBe(400);
    await expect(jsonBody(res)).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Idempotency-Key header is required",
    });
  });

  it("POST /api/v1/portaria/condominios/:id/encomendas/foto-upload returns upload contract and rejects cross-tenant", async () => {
    (mockBuildFotoKey as MockInstance).mockReturnValue("encomendas/condo-1/upload-id.jpg");
    (mockGeneratePresignedUploadUrl as MockInstance).mockResolvedValue("https://upload.example.test/url");

    const okRes = await fotoUploadPost(
      makeReq({ nomeArquivo: "etiqueta.jpg", contentType: "image/jpeg" }),
      makeCtx({ id: "condo-1" })
    );
    const crossTenantRes = await fotoUploadPost(
      makeReq({ nomeArquivo: "etiqueta.jpg", contentType: "image/jpeg" }),
      makeCtx({ id: "condo-2" })
    );

    expect(okRes.status).toBe(201);
    await expect(jsonBody(okRes)).resolves.toMatchObject({
      uploadUrl: "https://upload.example.test/url",
      fotoKey: "encomendas/condo-1/upload-id.jpg",
      expiresInSeconds: 300,
      contentType: "image/jpeg",
    });

    expect(crossTenantRes.status).toBe(403);
    await expect(jsonBody(crossTenantRes)).resolves.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
