import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export { TENANT_SCOPED_MODELS } from "./constants";

export interface TenantContext {
  condominioId: string;
  userId: string;
}

/**
 * Extracts tenant context from the current request session.
 * Throws AppError FORBIDDEN when no valid session / tenant is present.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();

  if (!session?.user?.id || !session.condominioId) {
    throw new AppError("FORBIDDEN", "No active tenant session");
  }

  return {
    condominioId: session.condominioId,
    userId: session.user.id,
  };
}
