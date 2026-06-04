// Cursor-based pagination per ARD §4.3

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total?: number | undefined;
}

export interface PaginationParams {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const rawCursor = searchParams.get("cursor");
  const cursor: string | undefined = rawCursor !== null ? rawCursor : undefined;
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit !== null
    ? Math.min(Math.max(1, parseInt(rawLimit, 10)), MAX_PAGE_LIMIT)
    : DEFAULT_PAGE_LIMIT;

  return { cursor, limit };
}

/**
 * Builds a PaginatedResponse from a Prisma-style result slice.
 * Caller should fetch limit+1 items; if the extra item exists it becomes the nextCursor.
 */
export function buildPage<T extends { id: string }>(
  items: T[],
  limit: number
): PaginatedResponse<T> {
  if (items.length > limit) {
    const data = items.slice(0, limit);
    const last = data[data.length - 1];
    return { data, nextCursor: last?.id ?? null };
  }
  return { data: items, nextCursor: null };
}
