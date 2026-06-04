import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { CriarReservaSchema } from "@/domain/reservas/schemas";
import {
  validationError,
  forbiddenError,
  handleRouteError,
} from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { criarReserva } from "@/application/reservas/use-cases/criar-reserva";

// GET /api/v1/reservas/condominios/:id/reservas
export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.CONSELHO
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

    const status = req.nextUrl.searchParams.get("status");
    const areaComumId = req.nextUrl.searchParams.get("areaComumId");
    const unidadeId = req.nextUrl.searchParams.get("unidadeId");

    const items = await db.reserva.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(status ? { status: status as never } : {}),
        ...(areaComumId ? { areaComumId } : {}),
        ...(unidadeId ? { unidadeId } : {}),
      },
      include: { areaComum: true },
      take: lim + 1,
      orderBy: { inicio: "asc" },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// POST /api/v1/reservas/condominios/:id/reservas (any active vinculo)
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = (await req.json()) as unknown;
    const parsed = CriarReservaSchema.safeParse(body);
    if (!parsed.success)
      return validationError(parsed.error.flatten()) as unknown as Response;

    const reserva = await criarReserva({
      condominioId,
      userId: tenantCtx.userId,
      areaComumId: parsed.data.areaComumId,
      inicio: new Date(parsed.data.inicio),
      fim: new Date(parsed.data.fim),
    });

    return NextResponse.json(reserva, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
