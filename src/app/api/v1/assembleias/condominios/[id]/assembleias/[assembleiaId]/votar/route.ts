import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { RegistrarVotoSchema } from "@/domain/assembleias/schemas";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { registrarVoto } from "@/application/assembleias/use-cases/registrar-voto";
import type { OpcaoVoto } from "@prisma/client";

export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.CONSELHO,
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const assembleiaId = params["assembleiaId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = RegistrarVotoSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const voto = await registrarVoto({
      condominioId,
      assembleiaId,
      itemPautaId: parsed.data.itemPautaId,
      userId: tenantCtx.userId,
      opcao: parsed.data.opcao as OpcaoVoto,
    });

    return NextResponse.json(voto, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
