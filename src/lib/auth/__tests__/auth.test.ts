/**
 * Unit tests for getAuthSession (CODAA-70 — Supabase JWT validation + tenant derivation).
 * All external dependencies mocked — no real Supabase or DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

// ── Mock Supabase admin client ──────────────────────────────────────────────
const { mockGetUser, mockUserFindUnique } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// ── Mock Prisma client ──────────────────────────────────────────────────────
vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
  },
  getPrismaWithTenant: vi.fn(),
}));

// ── System under test ───────────────────────────────────────────────────────
// Import AFTER mocks are registered
import { getAuthSession } from "@/lib/auth";
import type { NextRequest } from "next/server";

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  return { headers } as unknown as NextRequest;
}

const VALID_SUPABASE_USER = {
  id: "supabase-uuid-123",
  email: "user@condo.com",
};

const VALID_DB_USER = {
  id: "cuid-user-1",
  email: "user@condo.com",
  name: "Test User",
  vinculos: [
    {
      id: "vinculo-1",
      condominioId: "condo-1",
      perfil: "sindico",
      ativo: true,
      criadoEm: new Date("2026-01-01"),
    },
  ],
};

describe("getAuthSession — CODAA-70 JWT validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when Authorization header is absent", async () => {
    const result = await getAuthSession(makeRequest());
    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns null when header does not start with Bearer", async () => {
    const result = await getAuthSession(makeRequest("Basic abc123"));
    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns null when Bearer token is empty string", async () => {
    // "Bearer " (trailing space only) — token slice is ""
    const result = await getAuthSession(makeRequest("Bearer "));
    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns null when Supabase returns an error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid jwt") });

    const result = await getAuthSession(makeRequest("Bearer bad-token"));
    expect(result).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when Supabase returns no user (expired/revoked token)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getAuthSession(makeRequest("Bearer expired-token"));
    expect(result).toBeNull();
  });

  it("returns null when Supabase user has no email", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-uuid", email: undefined } },
      error: null,
    });

    const result = await getAuthSession(makeRequest("Bearer valid-token"));
    expect(result).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when no local User found for verified email", async () => {
    mockGetUser.mockResolvedValue({ data: { user: VALID_SUPABASE_USER }, error: null });
    mockUserFindUnique.mockResolvedValue(null);

    const result = await getAuthSession(makeRequest("Bearer valid-token"));
    expect(result).toBeNull();
  });

  it("returns null when local User exists but has no active vínculo", async () => {
    mockGetUser.mockResolvedValue({ data: { user: VALID_SUPABASE_USER }, error: null });
    mockUserFindUnique.mockResolvedValue({ ...VALID_DB_USER, vinculos: [] });

    const result = await getAuthSession(makeRequest("Bearer valid-token"));
    expect(result).toBeNull();
  });

  it("returns full AuthSession when token is valid and user has active vínculo", async () => {
    mockGetUser.mockResolvedValue({ data: { user: VALID_SUPABASE_USER }, error: null });
    mockUserFindUnique.mockResolvedValue(VALID_DB_USER);

    const result = await getAuthSession(makeRequest("Bearer valid-token"));

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      userId: "cuid-user-1",
      supabaseId: "supabase-uuid-123",
      email: "user@condo.com",
      name: "Test User",
      condominioId: "condo-1",
      perfil: "sindico",
      vinculoId: "vinculo-1",
    });
  });

  it("derives session from the first (oldest) vínculo when user has multiple", async () => {
    mockGetUser.mockResolvedValue({ data: { user: VALID_SUPABASE_USER }, error: null });
    mockUserFindUnique.mockResolvedValue({
      ...VALID_DB_USER,
      vinculos: [
        { id: "vinculo-first", condominioId: "condo-A", perfil: "porteiro", ativo: true, criadoEm: new Date("2025-01-01") },
        { id: "vinculo-second", condominioId: "condo-B", perfil: "sindico", ativo: true, criadoEm: new Date("2025-06-01") },
      ],
    });

    const result = await getAuthSession(makeRequest("Bearer valid-token"));

    expect(result?.vinculoId).toBe("vinculo-first");
    expect(result?.condominioId).toBe("condo-A");
    expect(result?.perfil).toBe("porteiro");
  });

  it("queries Prisma with the correct email from Supabase user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: VALID_SUPABASE_USER }, error: null });
    mockUserFindUnique.mockResolvedValue(VALID_DB_USER);

    await getAuthSession(makeRequest("Bearer valid-token"));

    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "user@condo.com" },
      })
    );
  });

  it("extracts the token string after 'Bearer ' prefix correctly", async () => {
    mockGetUser.mockResolvedValue({ data: { user: VALID_SUPABASE_USER }, error: null });
    mockUserFindUnique.mockResolvedValue(VALID_DB_USER);

    await getAuthSession(makeRequest("Bearer my-actual-token"));

    expect(mockGetUser).toHaveBeenCalledWith("my-actual-token");
  });
});
