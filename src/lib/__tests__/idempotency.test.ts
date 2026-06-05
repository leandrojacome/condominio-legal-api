import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const { mockCreate, mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    idempotencyRecord: {
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

import { AppError } from "@/lib/errors";
import { hashCanonicalPayload, withIdempotencyRecord } from "@/lib/idempotency";

const OPTIONS = {
  condominioId: "condo-1",
  operationScope: "financeiro.pix.emit",
  idempotencyKey: "idem-1",
  requestPayload: { cobrancaId: "cobranca-1", body: { valor: 10 } },
  expiresInMs: 60_000,
};

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("withIdempotencyRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending record, executes once, and stores the completed response", async () => {
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    const execute = vi.fn().mockResolvedValue(
      NextResponse.json(
        { id: "emissao-1", status: "emitido" },
        { status: 201, headers: { "Idempotency-Key": "idem-1" } }
      )
    );

    const response = await withIdempotencyRecord(OPTIONS, execute);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ id: "emissao-1" });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        condominioId: "condo-1",
        operationScope: "financeiro.pix.emit",
        idempotencyKey: "idem-1",
        requestHash: hashCanonicalPayload(OPTIONS.requestPayload),
        responseStatus: "pending",
        expiresAt: expect.any(Date),
      }),
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        condominioId_operationScope_idempotencyKey: {
          condominioId: "condo-1",
          operationScope: "financeiro.pix.emit",
          idempotencyKey: "idem-1",
        },
      },
      data: expect.objectContaining({
        responseStatus: "completed",
        statusCode: 201,
        responseBody: { id: "emissao-1", status: "emitido" },
      }),
    });
  });

  it("replays a completed response without executing the use case", async () => {
    mockCreate.mockRejectedValue(uniqueConstraintError());
    mockFindUnique.mockResolvedValue({
      requestHash: hashCanonicalPayload(OPTIONS.requestPayload),
      responseStatus: "completed",
      statusCode: 201,
      responseHeaders: { "x-custom": "replayed" },
      responseBody: { id: "emissao-1" },
    });
    const execute = vi.fn();

    const response = await withIdempotencyRecord(OPTIONS, execute);

    expect(response.status).toBe(201);
    expect(response.headers.get("Idempotency-Key")).toBe("idem-1");
    expect(response.headers.get("x-custom")).toBe("replayed");
    await expect(response.json()).resolves.toEqual({ id: "emissao-1" });
    expect(execute).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("stores and returns a replayable failed response when execution throws", async () => {
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    const err = new AppError("UNPROCESSABLE", "provider unavailable");

    const response = await withIdempotencyRecord(OPTIONS, vi.fn().mockRejectedValue(err));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNPROCESSABLE",
      message: "provider unavailable",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        condominioId_operationScope_idempotencyKey: {
          condominioId: "condo-1",
          operationScope: "financeiro.pix.emit",
          idempotencyKey: "idem-1",
        },
      },
      data: {
        responseStatus: "failed",
        statusCode: 422,
        responseHeaders: expect.any(Object),
        responseBody: {
          code: "UNPROCESSABLE",
          message: "provider unavailable",
        },
      },
    });
  });

  it("replays a failed record when it has a stored terminal response", async () => {
    mockCreate.mockRejectedValue(uniqueConstraintError());
    mockFindUnique.mockResolvedValue({
      requestHash: hashCanonicalPayload(OPTIONS.requestPayload),
      responseStatus: "failed",
      statusCode: 422,
      responseHeaders: { "x-error": "stored" },
      responseBody: { code: "UNPROCESSABLE", message: "provider unavailable" },
    });
    const execute = vi.fn();

    const response = await withIdempotencyRecord(OPTIONS, execute);

    expect(response.status).toBe(422);
    expect(response.headers.get("Idempotency-Key")).toBe("idem-1");
    expect(response.headers.get("x-error")).toBe("stored");
    await expect(response.json()).resolves.toEqual({
      code: "UNPROCESSABLE",
      message: "provider unavailable",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns an explicit conflict for failed records without replayable response", async () => {
    mockCreate.mockRejectedValue(uniqueConstraintError());
    mockFindUnique.mockResolvedValue({
      requestHash: hashCanonicalPayload(OPTIONS.requestPayload),
      responseStatus: "failed",
      statusCode: null,
      responseHeaders: null,
      responseBody: null,
    });

    await expect(
      withIdempotencyRecord(OPTIONS, vi.fn())
    ).rejects.toMatchObject(new AppError(
      "CONFLICT",
      "Idempotency-Key previous request failed before a replayable response was stored"
    ));
  });

  it("stores the returned response as failed and replayable if completed finalization fails", async () => {
    const finalizationError = new Error("completed update failed");
    mockCreate.mockResolvedValue({});
    mockUpdate
      .mockRejectedValueOnce(finalizationError)
      .mockResolvedValueOnce({});

    const response = await withIdempotencyRecord(
      OPTIONS,
      vi.fn().mockResolvedValue(NextResponse.json({ id: "emissao-1" }, { status: 201 }))
    );

    expect(response.status).toBe(201);
    expect(mockUpdate).toHaveBeenLastCalledWith({
      where: {
        condominioId_operationScope_idempotencyKey: {
          condominioId: "condo-1",
          operationScope: "financeiro.pix.emit",
          idempotencyKey: "idem-1",
        },
      },
      data: expect.objectContaining({
        responseStatus: "failed",
        statusCode: 201,
        responseBody: { id: "emissao-1" },
      }),
    });
  });

  it("rejects the same key when the canonical payload hash differs", async () => {
    mockCreate.mockRejectedValue(uniqueConstraintError());
    mockFindUnique.mockResolvedValue({
      requestHash: hashCanonicalPayload({ cobrancaId: "other" }),
      responseStatus: "completed",
      statusCode: 201,
      responseHeaders: {},
      responseBody: { id: "emissao-1" },
    });

    await expect(
      withIdempotencyRecord(OPTIONS, vi.fn())
    ).rejects.toMatchObject(new AppError(
      "CONFLICT",
      "Idempotency-Key was already used with a different request payload"
    ));
  });

  it("hashes object keys canonically", () => {
    expect(hashCanonicalPayload({ b: 2, a: { d: 4, c: 3 } })).toBe(
      hashCanonicalPayload({ a: { c: 3, d: 4 }, b: 2 })
    );
  });
});
