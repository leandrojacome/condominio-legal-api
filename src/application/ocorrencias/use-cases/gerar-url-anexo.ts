import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { SolicitarAnexoInput } from "@/domain/ocorrencias/schemas";
import { generatePresignedUploadUrl } from "@/infrastructure/storage/s3";

export async function gerarUrlAnexo(
  condominioId: string,
  ocorrenciaId: string,
  input: SolicitarAnexoInput
) {
  const db = getPrismaWithTenant(condominioId);

  const ocorrencia = await db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
  if (!ocorrencia) {
    throw new AppError("NOT_FOUND", "Ocorrência não encontrada");
  }

  const ext = input.nomeArquivo.split(".").pop() ?? "jpg";
  const anexoId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const key = `ocorrencias/${condominioId}/${ocorrenciaId}/${anexoId}.${ext}`;

  const uploadUrl = await generatePresignedUploadUrl(key, input.contentType ?? "image/jpeg");

  const anexo = await prisma.anexoOcorrencia.create({
    data: {
      ocorrenciaId,
      urlArquivo: key,
      ...(input.nomeArquivo !== undefined && { nomeArquivo: input.nomeArquivo }),
    },
  });

  return { anexo, uploadUrl };
}

export async function listarAnexos(condominioId: string, ocorrenciaId: string) {
  const db = getPrismaWithTenant(condominioId);

  const ocorrencia = await db.ocorrencia.findFirst({ where: { id: ocorrenciaId } });
  if (!ocorrencia) {
    throw new AppError("NOT_FOUND", "Ocorrência não encontrada");
  }

  const { generatePresignedDownloadUrl } = await import("@/infrastructure/storage/s3");

  const anexos = await prisma.anexoOcorrencia.findMany({
    where: { ocorrenciaId },
    orderBy: { criadoEm: "asc" },
  });

  return Promise.all(
    anexos.map(async (a) => ({
      ...a,
      downloadUrl: await generatePresignedDownloadUrl(a.urlArquivo),
    }))
  );
}
