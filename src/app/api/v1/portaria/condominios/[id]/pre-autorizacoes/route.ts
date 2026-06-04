import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import { PreAutorizarSchema } from "@/domain/portaria/schemas";
import { preAutorizar } from "@/application/portaria/use-cases/pre-autorizar";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import type { RouteContext } from "@/lib/auth/rbac";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext(req);

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const { cursor, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const items = await db.preAutorizacao.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { criadoEm: "desc" },
      take: (limit ?? 20) + 1,
    });

    return NextResponse.json(buildPage(items, limit ?? 20));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const POST = requirePerfil(
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const tenantCtx = await getTenantContext(req);

    if (id !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = PreAutorizarSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const preAuth = await preAutorizar(tenantCtx.condominioId, tenantCtx.userId, parsed.data);
    return NextResponse.json(preAuth, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
