import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { AppError, handleRouteError } from "@/lib/errors";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type JsonObject = Record<string, unknown>;

export interface IdempotencyRecordOptions {
  condominioId: string;
  operationScope: string;
  idempotencyKey: string;
  requestPayload: unknown;
  expiresInMs?: number;
}

export function getRequiredIdempotencyKey(req: NextRequest): string {
  const key = req.headers.get("idempotency-key")?.trim();

  if (!key) {
    throw new AppError("VALIDATION_ERROR", "Idempotency-Key header is required");
  }

  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new AppError("VALIDATION_ERROR", "Idempotency-Key header is too long");
  }

  return key;
}

export function idempotencyHeaders(key: string): HeadersInit {
  return { "Idempotency-Key": key };
}

export async function withIdempotencyRecord(
  options: IdempotencyRecordOptions,
  execute: () => Promise<NextResponse>
): Promise<NextResponse> {
  const requestHash = hashCanonicalPayload(options.requestPayload);
  const expiresAt = new Date(Date.now() + (options.expiresInMs ?? DEFAULT_IDEMPOTENCY_TTL_MS));
  let ownsPendingRecord = false;

  try {
    await prisma.idempotencyRecord.create({
      data: {
        condominioId: options.condominioId,
        operationScope: options.operationScope,
        idempotencyKey: options.idempotencyKey,
        requestHash,
        responseStatus: "pending",
        expiresAt,
      },
    });
    ownsPendingRecord = true;
  } catch (err) {
    if (!isUniqueConstraintError(err)) {
      throw err;
    }

    const existing = await prisma.idempotencyRecord.findUnique({
      where: {
        condominioId_operationScope_idempotencyKey: {
          condominioId: options.condominioId,
          operationScope: options.operationScope,
          idempotencyKey: options.idempotencyKey,
        },
      },
    });

    if (!existing) {
      throw err;
    }

    if (existing.requestHash !== requestHash) {
      throw new AppError(
        "CONFLICT",
        "Idempotency-Key was already used with a different request payload"
      );
    }

    if (
      (existing.responseStatus === "completed" || existing.responseStatus === "failed") &&
      existing.statusCode !== null &&
      existing.responseBody !== null
    ) {
      return replayStoredResponse(options.idempotencyKey, existing);
    }

    if (existing.responseStatus === "failed") {
      throw new AppError(
        "CONFLICT",
        "Idempotency-Key previous request failed before a replayable response was stored"
      );
    }

    throw new AppError("CONFLICT", "Idempotency-Key request is already in progress");
  }

  let response: NextResponse;
  try {
    response = await execute();
  } catch (err) {
    if (ownsPendingRecord) {
      const errorResponse = handleRouteError(err);
      await persistStoredResponse(options, "failed", errorResponse);
      return errorResponse;
    }
    throw err;
  }

  const responseBody = await readJsonResponseBody(response);
  const responseHeaders = responseHeadersToJson(response.headers);

  if (ownsPendingRecord) {
    await prisma.idempotencyRecord.update({
      where: idempotencyRecordWhere(options),
      data: {
        responseStatus: "completed",
        statusCode: response.status,
        responseHeaders,
        responseBody,
      },
    }).catch(async (err) => {
      await prisma.idempotencyRecord.update({
        where: idempotencyRecordWhere(options),
        data: {
          responseStatus: "failed",
          statusCode: response.status,
          responseHeaders,
          responseBody,
        },
      });
      console.error("[idempotency] failed to mark record completed; stored replayable failed response", err);
    });
  }

  return response;
}

export function hashCanonicalPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function replayHeaders(idempotencyKey: string, headers: Prisma.JsonValue | null): HeadersInit {
  return {
    ...jsonObjectToStringHeaders(headers),
    ...idempotencyHeaders(idempotencyKey),
  };
}

function replayStoredResponse(
  idempotencyKey: string,
  record: {
    statusCode: number | null;
    responseHeaders: Prisma.JsonValue | null;
    responseBody: Prisma.JsonValue | null;
  }
): NextResponse {
  return NextResponse.json(record.responseBody ?? {}, {
    status: record.statusCode ?? 500,
    headers: replayHeaders(idempotencyKey, record.responseHeaders),
  });
}

async function persistStoredResponse(
  options: IdempotencyRecordOptions,
  responseStatus: "completed" | "failed",
  response: NextResponse
): Promise<void> {
  await prisma.idempotencyRecord.update({
    where: idempotencyRecordWhere(options),
    data: {
      responseStatus,
      statusCode: response.status,
      responseHeaders: responseHeadersToJson(response.headers),
      responseBody: await readJsonResponseBody(response),
    },
  });
}

function idempotencyRecordWhere(options: IdempotencyRecordOptions) {
  return {
    condominioId_operationScope_idempotencyKey: {
      condominioId: options.condominioId,
      operationScope: options.operationScope,
      idempotencyKey: options.idempotencyKey,
    },
  };
}

function responseHeadersToJson(headers: Headers): Prisma.InputJsonObject {
  const responseHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  return responseHeaders;
}

function jsonObjectToStringHeaders(value: Prisma.JsonValue | null): Record<string, string> {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    })
  );
}

async function readJsonResponseBody(response: NextResponse): Promise<Prisma.InputJsonValue> {
  const body = await response.clone().json().catch(() => ({}));
  return toInputJsonValue(body);
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null) {
    return {};
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toNestedJsonValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toNestedJsonValue(item)])
    );
  }

  return {};
}

function toNestedJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  return toInputJsonValue(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
