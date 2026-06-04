import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AtualizarAreaComumSchema } from "@/domain/reservas/schemas";
import {
  validationError,
  forbiddenError,
  notFoundError,
  handleRouteError,
} from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { stripUndefined } from "@/lib/utils";
import type {
  Granularidade,
  PoliticaConflito,
  ModoAprovacao,
} from "@prisma/client";

// GET /api/v1/reservas/condominios/:id/areas/:areaId
export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const areaId = params["areaId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const area = await db.areaComum.findFirst({ where: { id: areaId } });
    if (!area) return notFoundError("AreaComum") as unknown as Response;

    return NextResponse.json(area);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

// PATCH /api/v1/reservas/condominios/:id/areas/:areaId
export const PATCH = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const areaId = params["areaId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = (await req.json()) as unknown;
    const parsed = AtualizarAreaComumSchema.safeParse(body);
    if (!parsed.success)
      return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    // Check exists
    const exists = await db.areaComum.findFirst({ where: { id: areaId } });
    if (!exists) return notFoundError("AreaComum") as unknown as Response;

    const rawData = stripUndefined({
      ...(parsed.data.nome !== undefined ? { nome: parsed.data.nome } : {}),
      ...(parsed.data.granularidade !== undefined
        ? { granularidade: parsed.data.granularidade as Granularidade }
        : {}),
      ...(parsed.data.politicaConflito !== undefined
        ? { politicaConflito: parsed.data.politicaConflito as PoliticaConflito }
        : {}),
      ...(parsed.data.modoAprovacao !== undefined
        ? { modoAprovacao: parsed.data.modoAprovacao as ModoAprovacao }
        : {}),
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
      ...(parsed.data.ativa !== undefined
        ? { ativa: parsed.data.ativa }
        : {}),
    });

    const area = await db.areaComum.update({
      where: { id: areaId },
      data: rawData,
    });

    return NextResponse.json(area);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
