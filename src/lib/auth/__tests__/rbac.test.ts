/**
 * Unit tests for requirePerfil RBAC middleware (CODAA-70).
 * Verifies 401/403 gates and happy-path pass-through.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock getAuthSession ────────────────────────────────────────────────────
const { mockGetAuthSession } = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
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

// Import after mocks
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { NextRequest } from "next/server";
import type { RouteContext } from "@/lib/auth/rbac";

function fakeReq(): NextRequest {
  return {} as NextRequest;
}

function fakeCtx(): RouteContext {
  return { params: Promise.resolve({}) };
}

const SINDICO_SESSION = {
  userId: "u1",
  supabaseId: "sb-u1",
  email: "sindico@test.com",
  name: "Síndico",
  condominioId: "condo-1",
  perfil: PerfilUsuario.SINDICO,
  vinculoId: "v1",
};

describe("requirePerfil RBAC middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no valid session", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const handler = vi.fn();
    const wrapped = requirePerfil(PerfilUsuario.SINDICO)(handler);
    const response = await wrapped(fakeReq(), fakeCtx());

    expect((response as unknown as Response).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when the user's perfil is not in the allowed list", async () => {
    mockGetAuthSession.mockResolvedValue({
      ...SINDICO_SESSION,
      perfil: PerfilUsuario.PORTEIRO,
    });

    const handler = vi.fn();
    const wrapped = requirePerfil(PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA)(handler);
    const response = await wrapped(fakeReq(), fakeCtx());

    expect((response as unknown as Response).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when the user's perfil matches the only allowed perfil", async () => {
    mockGetAuthSession.mockResolvedValue(SINDICO_SESSION);

    const handlerResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const handler = vi.fn().mockResolvedValue(handlerResponse);

    const wrapped = requirePerfil(PerfilUsuario.SINDICO)(handler);
    const response = await wrapped(fakeReq(), fakeCtx());

    expect(handler).toHaveBeenCalledOnce();
    expect((response as unknown as Response).status).toBe(200);
  });

  it("calls handler when the user's perfil is one of multiple allowed perfis", async () => {
    mockGetAuthSession.mockResolvedValue({
      ...SINDICO_SESSION,
      perfil: PerfilUsuario.ADMINISTRADORA,
    });

    const handlerResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const handler = vi.fn().mockResolvedValue(handlerResponse);

    const wrapped = requirePerfil(
      PerfilUsuario.SINDICO,
      PerfilUsuario.ADMINISTRADORA,
      PerfilUsuario.CONSELHO
    )(handler);
    const response = await wrapped(fakeReq(), fakeCtx());

    expect(handler).toHaveBeenCalledOnce();
    expect((response as unknown as Response).status).toBe(200);
  });

  it("passes req and ctx through to the handler unchanged", async () => {
    mockGetAuthSession.mockResolvedValue(SINDICO_SESSION);

    const handlerResponse = new Response(null, { status: 204 });
    const handler = vi.fn().mockResolvedValue(handlerResponse);

    const req = fakeReq();
    const ctx = fakeCtx();
    const wrapped = requirePerfil(PerfilUsuario.SINDICO)(handler);
    await wrapped(req, ctx);

    expect(handler).toHaveBeenCalledWith(req, ctx);
  });

  it("returns 401 with UNAUTHORIZED code in body", async () => {
    mockGetAuthSession.mockResolvedValue(null);

    const handler = vi.fn();
    const wrapped = requirePerfil(PerfilUsuario.SINDICO)(handler);
    const response = await wrapped(fakeReq(), fakeCtx()) as unknown as Response;
    const body = await response.json() as { code: string };

    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 with FORBIDDEN code in body", async () => {
    mockGetAuthSession.mockResolvedValue({
      ...SINDICO_SESSION,
      perfil: PerfilUsuario.INQUILINO,
    });

    const handler = vi.fn();
    const wrapped = requirePerfil(PerfilUsuario.SINDICO)(handler);
    const response = await wrapped(fakeReq(), fakeCtx()) as unknown as Response;
    const body = await response.json() as { code: string };

    expect(body.code).toBe("FORBIDDEN");
  });
});
