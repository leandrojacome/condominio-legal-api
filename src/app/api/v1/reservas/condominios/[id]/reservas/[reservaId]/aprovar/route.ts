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

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const reserva = await db.reserva.findFirst({ where: { id: reservaId } });
    if (!reserva) return notFoundError("Reserva") as unknown as Response;

    if (reserva.status !== "pendente") {
      return unprocessableError(
        `Reserva não está pendente (status: ${reserva.status})`
      ) as unknown as Response;
    }

    const area = await db.areaComum.findFirst({
      where: { id: reserva.areaComumId },
    });

    if (!area) return notFoundError("AreaComum") as unknown as Response;

    // Update reserva to confirmada
    const updated = await db.reserva.update({
      where: { id: reservaId },
      data: { status: "confirmada" },
    });

    // Create cobrança if taxaUso > 0
    if (area.taxaUso !== null && area.taxaUso !== undefined && area.taxaUso > 0) {
      const hoje = new Date();
      const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

      const cobranca = await db.cobranca.create({
        data: {
          condominioId,
          unidadeId: reserva.unidadeId,
          tipo: "consumo",
          valor: area.taxaUso,
          competencia,
          vencimento: reserva.inicio,
          descricao: `Taxa de uso: ${area.nome}`,
        },
      });

      const comCobranca = await db.reserva.update({
        where: { id: reservaId },
        data: { cobrancaId: cobranca.id },
      });

      return NextResponse.json(comCobranca);
    }

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
