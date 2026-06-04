import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import {
  forbiddenError,
  notFoundError,
  unprocessableError,
  handleRouteError,
} from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

// POST /api/v1/reservas/condominios/:id/reservas/:reservaId/cancelar
// Owner or admin can cancel
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const reservaId = params["reservaId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const reserva = await db.reserva.findFirst({
      where: { id: reservaId },
      include: { unidade: true },
    });
    if (!reserva) return notFoundError("Reserva") as unknown as Response;

    // Check if already cancelled or rejected
    if (reserva.status === "cancelada" || reserva.status === "rejeitada") {
      return unprocessableError(
        `Reserva já está ${reserva.status}`
      ) as unknown as Response;
    }

    // Non-admin users can only cancel their own reserva (via vinculo)
    const isAdmin =
      tenantCtx.userId !== undefined &&
      (await (async () => {
        // Check if user is sindico or administradora - they can cancel any reserva
        // We allow it if they passed requirePerfil check above and their vinculo is admin
        const vinculo = await db.vinculo.findFirst({
          where: {
            userId: tenantCtx.userId,
            ativo: true,
          },
        });
        if (!vinculo) return false;
        return (
          vinculo.perfil === PerfilUsuario.SINDICO ||
          vinculo.perfil === PerfilUsuario.ADMINISTRADORA
        );
      })());

    if (!isAdmin) {
      // Non-admins can only cancel reservas for their own unidade
      const vinculo = await db.vinculo.findFirst({
        where: {
          userId: tenantCtx.userId,
          ativo: true,
        },
      });

      if (!vinculo || vinculo.unidadeId !== reserva.unidadeId) {
        return forbiddenError(
          "Apenas o proprietário/inquilino da unidade ou administradores podem cancelar esta reserva"
        ) as unknown as Response;
      }
    }

    const updated = await db.reserva.update({
      where: { id: reservaId },
      data: { status: "cancelada" },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
