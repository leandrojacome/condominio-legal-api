import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { RegistrarProcuracaoSchema } from "@/domain/assembleias/schemas";
import { validationError, forbiddenError, notFoundError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { registrarProcuracao } from "@/application/assembleias/use-cases/registrar-procuracao";

export const GET = requirePerfil(
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

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const assembleia = await db.assembleia.findFirst({
      where: { id: assembleiaId },
    });

    if (!assembleia) {
      return notFoundError("Assembleia") as unknown as Response;
    }

    const procuracoes = await db.procuracao.findMany({
      where: { assembleiaId },
    });

    return NextResponse.json(procuracoes);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// POST — register a proxy (procuração) for voting
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
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
    const parsed = RegistrarProcuracaoSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const procuracao = await registrarProcuracao({
      condominioId,
      assembleiaId,
      unidadeRepresentadaId: parsed.data.unidadeRepresentadaId,
      procuradorId: parsed.data.procuradorId,
      validoAte: parsed.data.validoAte,
    });

    return NextResponse.json(procuracao, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
