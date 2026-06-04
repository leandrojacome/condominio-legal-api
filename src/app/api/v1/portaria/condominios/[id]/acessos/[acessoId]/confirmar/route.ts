import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { ConfirmarAcessoSchema } from "@/domain/portaria/schemas";
import { confirmarAcesso } from "@/application/portaria/use-cases/confirmar-acesso";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import type { RouteContext } from "@/lib/auth/rbac";

export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const acessoId = params["acessoId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = ConfirmarAcessoSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const acesso = await confirmarAcesso(tenantCtx.condominioId, acessoId, parsed.data);
    return NextResponse.json(acesso);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
