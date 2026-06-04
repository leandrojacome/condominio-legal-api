import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { z } from "zod";
import { validationError, notFoundError, forbiddenError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";
import { generatePresignedUploadUrl, buildFotoKey } from "@/infrastructure/storage/s3";

const AnexoSchema = z.object({
  nomeArquivo: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100).optional(),
});

// POST — request a pre-signed upload URL; client uploads directly to S3/R2
export const POST = requirePerfil(
  PerfilUsuario.SINDICO, PerfilUsuario.ADMINISTRADORA, PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.INQUILINO, PerfilUsuario.PORTEIRO, PerfilUsuario.CONSELHO
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
    const parsed = AnexoSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten()) as unknown as Response;

    const db = getPrismaWithTenant(tenantCtx.condominioId);
    const ocorrencia = await db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
    if (!ocorrencia) return notFoundError("Ocorrencia") as unknown as Response;

    const key = buildFotoKey(condominioId, `${ocorrenciaId}-${Date.now()}`, "ocorrencias");
    const uploadUrl = await generatePresignedUploadUrl(
      key,
      parsed.data.contentType ?? "image/jpeg"
    );

    // Register the attachment record (URL stored as S3 key for later pre-signed download)
    const anexo = await db.anexoOcorrencia.create({
      data: {
        ocorrenciaId,
        urlArquivo: key,
        ...(parsed.data.nomeArquivo !== undefined ? { nomeArquivo: parsed.data.nomeArquivo } : {}),
      },
    });

    return NextResponse.json({ uploadUrl, anexo }, { status: 201 });
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
