import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { RejeitarReservaSchema } from "@/domain/reservas/schemas";
import { forbiddenError, validationError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { rejeitarReserva } from "@/application/reservas/use-cases/rejeitar-reserva";

// POST /api/v1/reservas/condominios/:id/reservas/:reservaId/rejeitar
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const reservaId = params["reservaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = RejeitarReservaSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const reserva = await rejeitarReserva(tenantCtx.condominioId, reservaId, parsed.data.motivo);
    return NextResponse.json(reserva);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
