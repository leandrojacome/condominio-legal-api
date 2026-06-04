import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AtualizarStatusAssembleiaSchema } from "@/domain/assembleias/schemas";
import { validationError, forbiddenError, notFoundError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { abrirVotacao } from "@/application/assembleias/use-cases/abrir-votacao";
import { encerrarVotacao } from "@/application/assembleias/use-cases/encerrar-votacao";

export const GET = requirePerfil(
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
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const assembleia = await db.assembleia.findFirst({
      where: { id: assembleiaId },
      include: {
        itensPauta: {
          orderBy: { ordem: "asc" },
        },
        ata: true,
      },
    });

    if (!assembleia) {
      return notFoundError("Assembleia") as unknown as Response;
    }

    return NextResponse.json(assembleia);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// PATCH — transition status: convocada → em_votacao, em_votacao → votacao_encerrada
export const PATCH = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const assembleiaId = params["assembleiaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AtualizarStatusAssembleiaSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    let updated;
    if (parsed.data.status === "em_votacao") {
      updated = await abrirVotacao({ condominioId, assembleiaId });
    } else {
      updated = await encerrarVotacao({ condominioId, assembleiaId });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
