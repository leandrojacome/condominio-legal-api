/**
 * Unit tests for error utilities (src/lib/errors/index.ts).
 * Extends the smoke tests: exercises handleRouteError, errorResponse, and all helpers.
 */
import { describe, it, expect } from "vitest";
import {
  AppError,
  handleRouteError,
  errorResponse,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  unprocessableError,
  internalError,
  HTTP_STATUS,
} from "@/lib/errors";

describe("errorResponse", () => {
  it("sets the correct HTTP status from the code map", async () => {
    const response = errorResponse("NOT_FOUND", "thing not found");
    expect(response.status).toBe(404);
    const body = await response.json() as { code: string; message: string };
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("thing not found");
  });

  it("includes details when provided", async () => {
    const details = [{ field: "email", msg: "required" }];
    const response = errorResponse("VALIDATION_ERROR", "bad", details);
    const body = await response.json() as { details: unknown };
    expect(body.details).toEqual(details);
  });

  it("omits details when not provided", async () => {
    const response = errorResponse("INTERNAL", "boom");
    const body = await response.json() as Record<string, unknown>;
    expect("details" in body).toBe(false);
  });
});

describe("error helper functions", () => {
  it("validationError → 400", async () => {
    const r = validationError({ field: "x" });
    expect(r.status).toBe(400);
    const body = await r.json() as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("unauthorizedError → 401 with default message", async () => {
    const r = unauthorizedError();
    expect(r.status).toBe(401);
  });

  it("unauthorizedError → 401 with custom message", async () => {
    const r = unauthorizedError("Token expired");
    const body = await r.json() as { message: string };
    expect(body.message).toBe("Token expired");
  });

  it("forbiddenError → 403", async () => {
    const r = forbiddenError("Requires sindico");
    expect(r.status).toBe(403);
    const body = await r.json() as { message: string };
    expect(body.message).toBe("Requires sindico");
  });

  it("notFoundError → 404 with resource name in message", async () => {
    const r = notFoundError("Unidade");
    expect(r.status).toBe(404);
    const body = await r.json() as { message: string };
    expect(body.message).toContain("Unidade");
  });

  it("conflictError → 409", async () => {
    const r = conflictError("Already exists");
    expect(r.status).toBe(409);
  });

  it("unprocessableError → 422", async () => {
    const r = unprocessableError("Invalid state");
    expect(r.status).toBe(422);
  });

  it("internalError → 500", async () => {
    const r = internalError();
    expect(r.status).toBe(500);
  });
});

describe("handleRouteError", () => {
  it("converts AppError to the matching HTTP response", async () => {
    const err = new AppError("NOT_FOUND", "Condominio not found");
    const r = handleRouteError(err);
    expect(r.status).toBe(404);
    const body = await r.json() as { code: string; message: string };
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("Condominio not found");
  });

  it("returns 500 for non-AppError exceptions", async () => {
    const r = handleRouteError(new Error("unexpected crash"));
    expect(r.status).toBe(500);
  });

  it("returns 500 for plain string throws", async () => {
    const r = handleRouteError("string error");
    expect(r.status).toBe(500);
  });

  it("returns 500 for null/undefined throws", async () => {
    const r = handleRouteError(null);
    expect(r.status).toBe(500);
  });

  it("preserves AppError details in response body", async () => {
    const details = { field: "cnpj", msg: "invalid format" };
    const err = new AppError("VALIDATION_ERROR", "bad input", details);
    const r = handleRouteError(err);
    const body = await r.json() as { details: unknown };
    expect(body.details).toEqual(details);
  });
});

describe("HTTP_STATUS map completeness", () => {
  const EXPECTED_CODES = [
    "VALIDATION_ERROR",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "UNPROCESSABLE",
    "INTERNAL",
  ] as const;

  for (const code of EXPECTED_CODES) {
    it(`has entry for ${code}`, () => {
      expect(HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    });
  }
});
