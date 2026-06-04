import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { AprovarReservaSchema } from "@/domain/reservas/schemas";
import { forbiddenError, validationError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { aprovarReserva } from "@/application/reservas/use-cases/aprovar-reserva";

// POST /api/v1/reservas/condominios/:id/reservas/:reservaId/aprovar
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const reservaId = params["reservaId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json().catch(() => ({})) as unknown;
    const parsed = AprovarReservaSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const reserva = await aprovarReserva(tenantCtx.condominioId, reservaId, parsed.data.observacao);
    return NextResponse.json(reserva);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
