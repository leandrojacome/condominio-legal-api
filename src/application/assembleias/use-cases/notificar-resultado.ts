import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import { publicarComunicado } from "@/application/comunicacao/use-cases/publicar-comunicado";
import type { CanalNotificacao } from "@prisma/client";

export interface NotificarResultadoInput {
  condominioId: string;
  assembleiaId: string;
  autorId: string;
  canais?: CanalNotificacao[];
}

export async function notificarResultado(input: NotificarResultadoInput) {
  const db = getPrismaWithTenant(input.condominioId);

  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
    include: {
      itensPauta: { orderBy: { ordem: "asc" } },
    },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia não encontrada");
  }

  if (assembleia.status !== "apurada") {
    throw new AppError("UNPROCESSABLE", "Resultados só podem ser divulgados após apuração");
  }

  const linhas = assembleia.itensPauta.map((item) => {
    const r = item.resultado
      ? item.resultado.toUpperCase()
      : "SEM QUÓRUM / EMPATE";
    return `- **${item.titulo}**: ${r}`;
  });

  const conteudo = [
    `Os resultados da assembleia **${assembleia.titulo}** foram apurados.`,
    "",
    "## Resultados por Pauta",
    "",
    ...linhas,
  ].join("\n");

  return publicarComunicado(input.condominioId, input.autorId, {
    titulo: `Resultado da Assembleia: ${assembleia.titulo}`,
    conteudo,
    tipo: "aviso_geral",
    canais: input.canais,
  });
}
