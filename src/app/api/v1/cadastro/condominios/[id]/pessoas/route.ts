import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { CriarPessoaSchema } from "@/domain/cadastro/schemas";
import { validationError, conflictError, forbiddenError, handleRouteError } from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PORTEIRO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id: condominioId } = await ctx.params;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const { cursor, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const lim = limit ?? 20;

    const items = await db.pessoa.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      take: lim + 1,
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const POST = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id: condominioId } = await ctx.params;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = CriarPessoaSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    try {
      const pessoa = await db.pessoa.create({
        data: { ...parsed.data, condominioId },
      });
      return NextResponse.json(pessoa, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Unique constraint failed")) {
        return conflictError("CPF already registered in this condominio") as unknown as Response;
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
