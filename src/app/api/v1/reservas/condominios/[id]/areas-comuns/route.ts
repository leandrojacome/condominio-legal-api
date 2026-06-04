import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { CriarAreaComumSchema } from "@/domain/reservas/schemas";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { criarAreaComum } from "@/application/reservas/use-cases/criar-area-comum";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext();

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const { cursor, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const lim = limit ?? 20;

    const ativa = req.nextUrl.searchParams.get("ativa");

    const items = await db.areaComum.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(ativa !== null ? { ativa: ativa === "true" } : {}),
      },
      take: lim + 1,
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext();

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = CriarAreaComumSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const area = await criarAreaComum(tenantCtx.condominioId, parsed.data);
    return NextResponse.json(area, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
