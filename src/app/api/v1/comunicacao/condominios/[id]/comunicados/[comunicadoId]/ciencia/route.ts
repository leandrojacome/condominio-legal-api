import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { forbiddenError, notFoundError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

// POST /api/v1/comunicacao/condominios/:id/comunicados/:comunicadoId/ciencia
// Registers that the authenticated user has read the comunicado
export const POST = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO, PerfilUsuario.PORTEIRO, PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const comunicadoId = params["comunicadoId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    // Find the in_app delivery for this user
    const entrega = await db.entregaComunicado.findFirst({
      where: {
        comunicadoId,
        destinatarioId: tenantCtx.userId,
        canal: "in_app",
      },
    });

    if (!entrega) return notFoundError("Entrega") as unknown as Response;

    const updated = await db.entregaComunicado.update({
      where: { id: entrega.id },
      data: { dataCiencia: new Date() },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
