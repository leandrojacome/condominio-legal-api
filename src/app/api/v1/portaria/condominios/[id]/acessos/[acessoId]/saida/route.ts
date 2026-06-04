import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import {
  forbiddenError,
  notFoundError,
  unprocessableError,
  handleRouteError,
} from "@/lib/errors";
import { StatusAcesso } from "@prisma/client";
import type { RouteContext } from "@/lib/auth/rbac";

// POST /api/v1/portaria/condominios/[id]/acessos/[acessoId]/saida
// Records the visitor exit time and closes the access record.
export const POST = requirePerfil(
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const acessoId = params["acessoId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const acesso = await db.registroAcesso.findFirst({ where: { id: acessoId } });

    if (!acesso) {
      return notFoundError("Registro de acesso") as unknown as Response;
    }

    if (acesso.saida !== null) {
      return unprocessableError("Saída já registrada para este acesso") as unknown as Response;
    }

    if (acesso.status === StatusAcesso.negado || acesso.status === StatusAcesso.encerrado) {
      return unprocessableError(
        `Acesso não pode ter saída registrada: status atual é ${acesso.status}`
      ) as unknown as Response;
    }

    const updated = await db.registroAcesso.update({
      where: { id: acessoId },
      data: { saida: new Date(), status: StatusAcesso.encerrado },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
