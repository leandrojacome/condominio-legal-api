import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { ConvocarAssembleiaSchema } from "@/domain/assembleias/schemas";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { convocarAssembleia } from "@/application/assembleias/use-cases/convocar-assembleia";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.CONSELHO,
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const { cursor, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const lim = limit ?? 20;

    const status = req.nextUrl.searchParams.get("status");

    const items = await db.assembleia.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      take: lim + 1,
      orderBy: { dataHora: "desc" },
      include: { itensPauta: { orderBy: { ordem: "asc" } } },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// POST — convocar assembleia com itens de pauta obrigatórios (spec §Convocação exige ao menos um item de pauta)
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = ConvocarAssembleiaSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const assembleia = await convocarAssembleia({
      condominioId,
      userId: tenantCtx.userId,
      data: parsed.data,
    });

    return NextResponse.json(assembleia, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
