import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { AdicionarComentarioSchema } from "@/domain/ocorrencias/schemas";
import { adicionarComentario } from "@/application/ocorrencias/use-cases/adicionar-comentario";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { validationError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

const ALL_PERFIS = [
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO,
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.CONSELHO,
];

export const GET = requirePerfil(...ALL_PERFIS)(
  async (req: NextRequest, ctx: RouteContext) => {
    try {
      const params = await ctx.params;
      const id = params["id"] as string;
      const ocorrenciaId = params["ocorrenciaId"] as string;
      const tenantCtx = await getTenantContext();
      if (id !== tenantCtx.condominioId) {
        return forbiddenError("Access denied to this condominio") as unknown as Response;
      }

      const db = getPrismaWithTenant(tenantCtx.condominioId);
      const comentarios = await db.ocorrenciaHistorico.findMany({
        where: { ocorrenciaId, comentario: { not: null } },
        orderBy: { criadoEm: "asc" },
      });

      return NextResponse.json({ data: comentarios });
    } catch (err) {
      return handleRouteError(err) as unknown as Response;
    }
  }
);

export const POST = requirePerfil(...ALL_PERFIS)(
  async (req: NextRequest, ctx: RouteContext) => {
    try {
      const params = await ctx.params;
      const id = params["id"] as string;
      const ocorrenciaId = params["ocorrenciaId"] as string;
      const tenantCtx = await getTenantContext();
      if (id !== tenantCtx.condominioId) {
        return forbiddenError("Access denied to this condominio") as unknown as Response;
      }

      const body = await req.json() as unknown;
      const parsed = AdicionarComentarioSchema.safeParse(body);
      if (!parsed.success) {
        return validationError(parsed.error.flatten()) as unknown as Response;
      }

      const entrada = await adicionarComentario(
        tenantCtx.condominioId,
        ocorrenciaId,
        tenantCtx.userId,
        parsed.data
      );

      return NextResponse.json(entrada, { status: 201 });
    } catch (err) {
      return handleRouteError(err) as unknown as Response;
    }
  }
);
