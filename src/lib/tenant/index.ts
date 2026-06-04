import type { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export { TENANT_SCOPED_MODELS } from "./constants";

export interface TenantContext {
  condominioId: string;
  userId: string;
}

/**
 * Extracts tenant context from the Supabase Bearer token on the request.
 * Throws AppError FORBIDDEN when unauthenticated or no active vínculo.
 */
export async function getTenantContext(req: NextRequest): Promise<TenantContext> {
  const session = await getAuthSession(req);

  if (!session) {
    throw new AppError("FORBIDDEN", "No active tenant session");
  }

  return {
    condominioId: session.condominioId,
    userId: session.userId,
  };
}
