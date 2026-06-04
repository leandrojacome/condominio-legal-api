import { prisma, getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export interface GerarAtaInput {
  condominioId: string;
  assembleiaId: string;
}

export async function gerarAta(input: GerarAtaInput) {
  const db = getPrismaWithTenant(input.condominioId);

  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
    include: {
      itensPauta: {
        orderBy: { ordem: "asc" },
        include: { votos: true },
      },
      ata: true,
    },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia não encontrada");
  }

  if (assembleia.status !== "apurada") {
    throw new AppError("UNPROCESSABLE", "Ata só pode ser gerada após a apuração dos resultados");
  }

  // Build ata content
  const lines: string[] = [];
  lines.push(`# Ata da Assembleia`);
  lines.push(`**Título:** ${assembleia.titulo}`);
  lines.push(`**Data/Hora:** ${assembleia.dataHora.toISOString()}`);
  if (assembleia.local) lines.push(`**Local:** ${assembleia.local}`);
  lines.push(`**Modalidade:** ${assembleia.modalidade}`);
  lines.push(`**Status:** ${assembleia.status}`);
  lines.push(`**Gerada em:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Pauta e Resultados");
  lines.push("");

  for (const item of assembleia.itensPauta) {
    lines.push(`### ${item.ordem + 1}. ${item.titulo}`);
    if (item.descricao) lines.push(`*${item.descricao}*`);
    lines.push(`- Critério de voto: ${item.criterioVoto}`);
    lines.push(`- Quórum mínimo: ${item.quorumMinimo}%`);
    lines.push(`- Voto secreto: ${item.votoSecreto ? "Sim" : "Não"}`);
    lines.push("");

    const contagem = { sim: 0, nao: 0, abstencao: 0 };
    for (const voto of item.votos) {
      contagem[voto.opcao] += voto.peso;
    }
    const participacao = item.votos.reduce((acc, v) => acc + v.peso, 0);

    lines.push(`**Votos:**`);
    lines.push(`- Sim: ${contagem.sim.toFixed(4)}`);
    lines.push(`- Não: ${contagem.nao.toFixed(4)}`);
    lines.push(`- Abstenção: ${contagem.abstencao.toFixed(4)}`);
    lines.push(`- Participação total: ${participacao.toFixed(4)}`);

    if (item.resultado !== null) {
      lines.push(`**Resultado: ${item.resultado.toUpperCase()}**`);
    } else {
      lines.push(`**Resultado: SEM QUÓRUM / EMPATE**`);
    }
    lines.push("");
  }

  const conteudo = lines.join("\n");

  // Upsert ata — re-generating is allowed
  const ata = await prisma.ata.upsert({
    where: { assembleiaId: input.assembleiaId },
    create: {
      assembleiaId: input.assembleiaId,
      conteudo,
    },
    update: {
      conteudo,
      geradaEm: new Date(),
    },
  });

  return ata;
}
