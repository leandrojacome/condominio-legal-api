import { describe, it, expect } from "vitest";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { HTTP_STATUS, AppError } from "@/lib/errors";
import { parsePaginationParams, buildPage, DEFAULT_PAGE_LIMIT } from "@/lib/pagination";

describe("PerfilUsuario enum", () => {
  it("has all 6 profiles from ARD §3.4", () => {
    const profiles = Object.values(PerfilUsuario);
    expect(profiles).toHaveLength(6);
    expect(profiles).toContain("sindico");
    expect(profiles).toContain("administradora");
    expect(profiles).toContain("proprietario");
    expect(profiles).toContain("inquilino");
    expect(profiles).toContain("porteiro");
    expect(profiles).toContain("conselho");
  });
});

describe("HTTP_STATUS map", () => {
  it("maps all standard error codes", () => {
    expect(HTTP_STATUS.VALIDATION_ERROR).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.UNPROCESSABLE).toBe(422);
    expect(HTTP_STATUS.INTERNAL).toBe(500);
  });
});

describe("AppError", () => {
  it("carries code and message", () => {
    const err = new AppError("NOT_FOUND", "Resource not found");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Resource not found");
    expect(err.name).toBe("AppError");
  });
});

describe("pagination helpers", () => {
  it("parsePaginationParams returns defaults", () => {
    const params = parsePaginationParams(new URLSearchParams(""));
    expect(params.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(params.cursor).toBeUndefined();
  });

  it("parsePaginationParams caps limit at 100", () => {
    const params = parsePaginationParams(new URLSearchParams("limit=999"));
    expect(params.limit).toBe(100);
  });

  it("buildPage sets nextCursor when more items exist", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `id-${i}` }));
    const result = buildPage(items, 5);
    expect(result.data).toHaveLength(5);
    expect(result.nextCursor).toBe("id-4");
  });

  it("buildPage returns null nextCursor on last page", () => {
    const items = [{ id: "only" }];
    const result = buildPage(items, 5);
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
