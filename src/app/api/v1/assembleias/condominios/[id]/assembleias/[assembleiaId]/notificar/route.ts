import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { NotificarResultadoSchema } from "@/domain/assembleias/schemas";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { notificarResultado } from "@/application/assembleias/use-cases/notificar-resultado";
import type { CanalNotificacao } from "@prisma/client";

// POST — send assembly result notification via Comunicação module
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

    const body = await req.json() as unknown;
    const parsed = NotificarResultadoSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const notificarInput: import("@/application/assembleias/use-cases/notificar-resultado").NotificarResultadoInput = {
      condominioId,
      assembleiaId,
      autorId: tenantCtx.userId,
    };
    if (parsed.data.canais !== undefined) {
      notificarInput.canais = parsed.data.canais as CanalNotificacao[];
    }
    const resultado = await notificarResultado(notificarInput);

    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
