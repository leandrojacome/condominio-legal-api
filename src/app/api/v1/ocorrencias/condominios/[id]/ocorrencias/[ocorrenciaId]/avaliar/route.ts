import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AvaliarOcorrenciaSchema } from "@/domain/ocorrencias/schemas";
import {
  validationError, notFoundError, conflictError, unprocessableError,
  forbiddenError, handleRouteError
} from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

export const POST = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO, PerfilUsuario.CONSELHO
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const ocorrenciaId = params["ocorrenciaId"] as string;
    const tenantCtx = await getTenantContext(req);

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const body = await req.json() as unknown;
    const parsed = AvaliarOcorrenciaSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const ocorrencia = await db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
    if (!ocorrencia) return notFoundError("Ocorrencia") as unknown as Response;

    if (!ocorrencia.encerradaEm) {
      return unprocessableError("Avaliação só permitida após encerramento") as unknown as Response;
    }

    try {
      const avaliacao = await db.avaliacaoOcorrencia.create({
        data: {
          ocorrenciaId,
          classificacao: parsed.data.classificacao,
          ...(parsed.data.comentario !== undefined ? { comentario: parsed.data.comentario } : {}),
        },
      });
      return NextResponse.json(avaliacao, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Unique constraint failed")) {
        return conflictError("Ocorrência já foi avaliada") as unknown as Response;
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
