import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { CriarAreaComumSchema } from "@/domain/reservas/schemas";
import {
  validationError,
  forbiddenError,
  handleRouteError,
} from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import type {
  Granularidade,
  PoliticaConflito,
  ModoAprovacao,
} from "@prisma/client";

// GET /api/v1/reservas/condominios/:id/areas
export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.PORTEIRO,
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

    const ativaParam = req.nextUrl.searchParams.get("ativa");
    const ativa =
      ativaParam === "true" ? true : ativaParam === "false" ? false : undefined;

    const items = await db.areaComum.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(ativa !== undefined ? { ativa } : {}),
      },
      take: lim + 1,
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// POST /api/v1/reservas/condominios/:id/areas (SINDICO/ADMINISTRADORA only)
export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = (await req.json()) as unknown;
    const parsed = CriarAreaComumSchema.safeParse(body);
    if (!parsed.success)
      return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const area = await db.areaComum.create({
      data: {
        condominioId,
        nome: parsed.data.nome,
        granularidade: parsed.data.granularidade as Granularidade,
        politicaConflito: parsed.data.politicaConflito as PoliticaConflito,
        modoAprovacao: parsed.data.modoAprovacao as ModoAprovacao,
        ...(parsed.data.capacidade !== undefined
          ? { capacidade: parsed.data.capacidade }
          : {}),
        ...(parsed.data.antecedenciaMinimaHoras !== undefined
          ? { antecedenciaMinimaHoras: parsed.data.antecedenciaMinimaHoras }
          : {}),
        ...(parsed.data.antecedenciaMaximaDias !== undefined
          ? { antecedenciaMaximaDias: parsed.data.antecedenciaMaximaDias }
          : {}),
        ...(parsed.data.limiteReservasPorUnidade !== undefined
          ? { limiteReservasPorUnidade: parsed.data.limiteReservasPorUnidade }
          : {}),
        ...(parsed.data.taxaUso !== undefined
          ? { taxaUso: parsed.data.taxaUso }
          : {}),
      },
    });

    return NextResponse.json(area, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
