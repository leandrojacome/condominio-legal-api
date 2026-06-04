import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { CancelarReservaSchema } from "@/domain/reservas/schemas";
import { forbiddenError, validationError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { cancelarReserva } from "@/application/reservas/use-cases/cancelar-reserva";

// POST /api/v1/reservas/condominios/:id/reservas/:reservaId/cancelar
// Owner or admin can cancel; applies cancellation penalty rule per area config
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const reservaId = params["reservaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json().catch(() => ({})) as unknown;
    const parsed = CancelarReservaSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const result = await cancelarReserva(tenantCtx.condominioId, reservaId, tenantCtx.userId);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
