import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { apurarAssembleia } from "@/application/assembleias/use-cases/apurar-assembleia";

export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const assembleiaId = params["assembleiaId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const resultado = await apurarAssembleia({ condominioId, assembleiaId });

    return NextResponse.json(resultado);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
