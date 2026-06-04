import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { CriarVinculoSchema } from "@/domain/cadastro/schemas";
import {
  validationError,
  conflictError,
  unprocessableError,
  forbiddenError,
  handleRouteError,
} from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
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

    const items = await db.vinculo.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      take: lim + 1,
      orderBy: { criadoEm: "asc" },
      include: { pessoa: true, unidade: true },
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
    const parsed = CriarVinculoSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    // Enforce: pessoa and unidade must belong to the same condomínio
    const [pessoa, unidade] = await Promise.all([
      db.pessoa.findFirst({ where: { id: parsed.data.pessoaId } }),
      db.unidade.findFirst({ where: { id: parsed.data.unidadeId } }),
    ]);

    if (!pessoa) {
      return unprocessableError("Pessoa not found in this condominio") as unknown as Response;
    }
    if (!unidade) {
      return unprocessableError("Unidade not found in this condominio") as unknown as Response;
    }

    try {
      const vinculo = await db.vinculo.create({
        data: { ...parsed.data, condominioId },
        include: { pessoa: true, unidade: true },
      });
      return NextResponse.json(vinculo, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Unique constraint failed")) {
        return conflictError("Vinculo already exists for this pessoa/unidade/papel") as unknown as Response;
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
