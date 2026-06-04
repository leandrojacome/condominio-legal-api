import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import { CriarCondominioSchema } from "@/domain/cadastro/schemas";
import {
  validationError,
  conflictError,
  handleRouteError,
} from "@/lib/errors";
import { parsePaginationParams, buildPage } from "@/lib/pagination";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.CONSELHO
)(async (req: NextRequest) => {
  try {
    const ctx = await getTenantContext();
    const db = getPrismaWithTenant(ctx.condominioId);
    const { cursor, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const lim = limit ?? 20;

    const items = await db.condominio.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      take: lim + 1,
      orderBy: { criadoEm: "asc" },
    });

    return NextResponse.json(buildPage(items, lim));
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const POST = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest) => {
  try {
    const body = await req.json() as unknown;
    const parsed = CriarCondominioSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten()) as unknown as Response;
    }

    const existing = await prisma.condominio.findUnique({
      where: { cnpj: parsed.data.cnpj },
    });
    if (existing) {
      return conflictError("CNPJ already registered") as unknown as Response;
    }

    const { multaAtraso, jurosMensal, ...requiredFields } = parsed.data;
    const condominio = await prisma.condominio.create({
      data: {
        ...requiredFields,
        ...(multaAtraso !== undefined ? { multaAtraso } : {}),
        ...(jurosMensal !== undefined ? { jurosMensal } : {}),
      },
    });

    return NextResponse.json(condominio, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
