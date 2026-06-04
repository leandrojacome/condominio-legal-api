import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { prisma } from "@/infrastructure/db/client";
import { forbiddenError, notFoundError, unprocessableError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { gerarAta } from "@/application/assembleias/use-cases/gerar-ata";

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

    if (assembleia.status !== "apurada") {
      return unprocessableError("Ata disponível apenas após apuração") as unknown as Response;
    }

    const ata = await prisma.ata.findUnique({
      where: { assembleiaId },
    });

    if (!ata) {
      return notFoundError("Ata") as unknown as Response;
    }

    return NextResponse.json(ata);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// POST — generate/regenerate ata after apuração
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

    const ata = await gerarAta({ condominioId, assembleiaId });

    return NextResponse.json(ata, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
