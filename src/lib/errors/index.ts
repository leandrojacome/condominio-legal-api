import { NextResponse } from "next/server";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// HTTP status map per ARD §4.2
export const HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  GONE: 410,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof HTTP_STATUS;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown
): NextResponse<ApiError> {
  const status = HTTP_STATUS[code];
  const body: ApiError = { code, message };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export function validationError(details: unknown): NextResponse<ApiError> {
  return errorResponse("VALIDATION_ERROR", "Validation failed", details);
}

export function unauthorizedError(message = "Not authenticated"): NextResponse<ApiError> {
  return errorResponse("UNAUTHORIZED", message);
}

export function forbiddenError(message = "Access denied"): NextResponse<ApiError> {
  return errorResponse("FORBIDDEN", message);
}

export function notFoundError(resource: string): NextResponse<ApiError> {
  return errorResponse("NOT_FOUND", `${resource} not found`);
}

export function conflictError(message: string): NextResponse<ApiError> {
  return errorResponse("CONFLICT", message);
}

export function unprocessableError(message: string): NextResponse<ApiError> {
  return errorResponse("UNPROCESSABLE", message);
}

export function goneError(message: string): NextResponse<ApiError> {
  return errorResponse("GONE", message);
}

export function internalError(): NextResponse<ApiError> {
  return errorResponse("INTERNAL", "Internal server error");
}

export function handleRouteError(err: unknown): NextResponse<ApiError> {
  if (err instanceof AppError) {
    return errorResponse(err.code, err.message, err.details);
  }
  console.error("[unhandled error]", err);
  return internalError();
}
