import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import type { AbrirOcorrenciaInput } from "@/domain/ocorrencias/schemas";
import type { TipoOcorrencia, PrioridadeOcorrencia } from "@prisma/client";
import { getStatusInicial } from "./configurar-fluxo";
import { agendarJobSLA } from "@/infrastructure/queue/sla-job";

export async function abrirOcorrencia(
  condominioId: string,
  autorId: string,
  input: AbrirOcorrenciaInput
) {
  const db = getPrismaWithTenant(condominioId);
  const statusInicial = await getStatusInicial(condominioId);

  const ocorrencia = await db.ocorrencia.create({
    data: {
      condominioId,
      autorId,
      tipo: input.tipo as TipoOcorrencia,
      titulo: input.titulo,
      descricao: input.descricao,
      status: statusInicial,
      ...(input.unidadeId !== undefined && { unidadeId: input.unidadeId }),
      ...(input.prioridade !== undefined && { prioridade: input.prioridade as PrioridadeOcorrencia }),
      ...(input.slaHoras !== undefined && { slaHoras: input.slaHoras }),
    },
  });

  await prisma.ocorrenciaHistorico.create({
    data: {
      ocorrenciaId: ocorrencia.id,
      statusAnterior: "",
      statusNovo: statusInicial,
      autorId,
    },
  });

  if (input.slaHoras !== undefined) {
    await agendarJobSLA(ocorrencia.id, input.slaHoras);
  }

  return ocorrencia;
}
