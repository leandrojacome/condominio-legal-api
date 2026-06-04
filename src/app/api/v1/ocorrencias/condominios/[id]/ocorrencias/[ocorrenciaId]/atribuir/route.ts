import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { AtribuirResponsavelSchema } from "@/domain/ocorrencias/schemas";
import { atribuirResponsavel } from "@/application/ocorrencias/use-cases/atribuir-responsavel";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const PATCH = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PORTEIRO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const id = params["id"] as string;
    const ocorrenciaId = params["ocorrenciaId"] as string;
    const tenantCtx = await getTenantContext();
    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AtribuirResponsavelSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const updated = await atribuirResponsavel(tenantCtx.condominioId, ocorrenciaId, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
