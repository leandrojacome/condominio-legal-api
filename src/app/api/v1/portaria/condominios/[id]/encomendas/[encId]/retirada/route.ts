import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { RegistrarRetiradaSchema } from "@/domain/portaria/schemas";
import {
  validationError,
  forbiddenError,
  notFoundError,
  unprocessableError,
  handleRouteError,
} from "@/lib/errors";
import type { RouteContext } from "@/lib/auth/rbac";

export const PATCH = requirePerfil(
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const encId = params["encId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = RegistrarRetiradaSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const encomenda = await db.encomenda.findFirst({ where: { id: encId } });

    if (!encomenda) {
      return notFoundError("Encomenda") as unknown as Response;
    }

    if (encomenda.retiradaEm !== null) {
      return unprocessableError("Encomenda já foi retirada") as unknown as Response;
    }

    const updated = await db.encomenda.update({
      where: { id: encId },
      data: {
        retiradaEm: new Date(),
        retiradorId: parsed.data.retiradorId ?? tenantCtx.userId,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
