import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { CriarComunicadoSchema } from "@/domain/comunicacao/schemas";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { publicarComunicado } from "@/application/comunicacao/use-cases/publicar-comunicado";

// GET — any tenant user can read comunicados
export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO, PerfilUsuario.PORTEIRO, PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const { cursor, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const lim = limit ?? 20;

    const items = await db.comunicado.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      take: lim + 1,
      orderBy: { criadoEm: "desc" },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// POST — only authorized profiles can publish per ARD §3.4
export const POST = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PORTEIRO, PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = CriarComunicadoSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const result = await publicarComunicado(condominioId, tenantCtx.userId, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
