import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { forbiddenError, unauthorizedError } from "@/lib/errors";

export type RouteContext = { params: Promise<Record<string, string>> };
export type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

/**
 * RBAC middleware — wraps a route handler and enforces perfil authorization.
 * Returns 401 when unauthenticated, 403 when the user's perfil is not in the allowed list.
 */
export function requirePerfil(...perfis: PerfilUsuario[]) {
  return (handler: RouteHandler): RouteHandler =>
    async (req: NextRequest, ctx: RouteContext) => {
      const session = await auth();

      if (!session?.user) {
        return unauthorizedError() as unknown as Response;
      }

      if (!session.perfil || !perfis.includes(session.perfil)) {
        return forbiddenError(
          `Requires one of: ${perfis.join(", ")}`
        ) as unknown as Response;
      }

      return handler(req, ctx);
    };
}

export { PerfilUsuario };
