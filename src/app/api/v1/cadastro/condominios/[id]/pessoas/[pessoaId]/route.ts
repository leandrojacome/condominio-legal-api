import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AtualizarPessoaSchema } from "@/domain/cadastro/schemas";
import { validationError, notFoundError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { stripUndefined } from "@/lib/utils";

export const GET = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PORTEIRO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const pessoaId = params["pessoaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const pessoa = await db.pessoa.findFirst({ where: { id: pessoaId } });
    if (!pessoa) return notFoundError("Pessoa") as unknown as Response;

    return NextResponse.json(pessoa);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});

export const PATCH = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const pessoaId = params["pessoaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied to this condominio") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AtualizarPessoaSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const pessoa = await db.pessoa.update({
      where: { id: pessoaId },
      data: stripUndefined(parsed.data),
    });

    return NextResponse.json(pessoa);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
