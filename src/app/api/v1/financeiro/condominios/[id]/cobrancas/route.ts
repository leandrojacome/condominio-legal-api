import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { CriarCobrancaSchema } from "@/domain/financeiro/schemas";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { criarCobranca } from "@/application/financeiro/use-cases/criar-cobranca";
import { StatusCobranca, type TipoCobranca } from "@prisma/client";
import type { CriarCobrancaInput } from "@/application/financeiro/use-cases/criar-cobranca";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
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
    const unidadeId = req.nextUrl.searchParams.get("unidadeId");
    const devedorId = req.nextUrl.searchParams.get("devedorId");

    const items = await db.cobranca.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(status && (Object.values(StatusCobranca) as string[]).includes(status) ? { status: status as StatusCobranca } : {}),
        ...(unidadeId ? { unidadeId } : {}),
        ...(devedorId ? { devedorId } : {}),
      },
      include: { devedor: { include: { pessoa: true } } },
      take: lim + 1,
      orderBy: { vencimento: "asc" },
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
    const condominioId = (await ctx.params)["id"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = CriarCobrancaSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const input: CriarCobrancaInput = {
      condominioId,
      unidadeId: parsed.data.unidadeId,
      tipo: parsed.data.tipo as TipoCobranca,
      valor: parsed.data.valor,
      competencia: parsed.data.competencia,
      vencimento: new Date(parsed.data.vencimento),
      ...(parsed.data.descricao !== undefined ? { descricao: parsed.data.descricao } : {}),
    };

    const cobranca = await criarCobranca(input);
    return NextResponse.json(cobranca, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
