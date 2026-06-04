import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { prisma } from "@/infrastructure/db/client";
import { AdicionarItemPautaSchema } from "@/domain/assembleias/schemas";
import {
  validationError,
  forbiddenError,
  notFoundError,
  handleRouteError,
} from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import type { CriterioVoto } from "@prisma/client";

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
    });

    if (!assembleia) {
      return notFoundError("Assembleia") as unknown as Response;
    }

    const itens = await prisma.itemPauta.findMany({
      where: { assembleiaId },
      orderBy: { ordem: "asc" },
    });

    return NextResponse.json(itens);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const POST = requirePerfil(
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

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const assembleia = await db.assembleia.findFirst({
      where: { id: assembleiaId },
    });

    if (!assembleia) {
      return notFoundError("Assembleia") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AdicionarItemPautaSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const item = await prisma.itemPauta.create({
      data: {
        assembleiaId,
        titulo: parsed.data.titulo,
        criterioVoto: parsed.data.criterioVoto as CriterioVoto,
        quorumMinimo: parsed.data.quorumMinimo,
        ordem: parsed.data.ordem,
        ...(parsed.data.descricao !== undefined
          ? { descricao: parsed.data.descricao }
          : {}),
        ...(parsed.data.votoSecreto !== undefined
          ? { votoSecreto: parsed.data.votoSecreto }
          : {}),
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
