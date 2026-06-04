import { prisma, getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { OpcaoVoto } from "@prisma/client";

export interface ApurarResultadoInput {
  condominioId: string;
  assembleiaId: string;
}

export interface ResultadoItemPauta {
  itemPautaId: string;
  titulo: string;
  totalVotos: number;
  pessoTotalVotado: number;
  quorumAtingido: boolean;
  resultado: OpcaoVoto | null;
  tally: Record<string, number>;
}

export interface ApuracaoResult {
  assembleiaId: string;
  itens: ResultadoItemPauta[];
}

export async function apurarResultado(input: ApurarResultadoInput): Promise<ApuracaoResult> {
  const db = getPrismaWithTenant(input.condominioId);

  // Find assembleia
  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
    include: {
      itensPauta: {
        include: {
          votos: true,
        },
        orderBy: { ordem: "asc" },
      },
    },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia not found");
  }

  if (assembleia.status === "apurada") {
    throw new AppError("CONFLICT", "Assembleia já foi apurada");
  }

  // Gather all unidades with fracaoIdeal for quorum calculation
  const unidades = await db.unidade.findMany({
    where: { ativo: true },
    select: { id: true, fracaoIdeal: true },
  });

  const totalUnidades = unidades.length;
  const totalFracaoIdeal = unidades.reduce((acc, u) => acc + (u.fracaoIdeal ?? 0), 0);

  const resultados: ResultadoItemPauta[] = [];

  for (const item of assembleia.itensPauta) {
    const votos = item.votos;
    const totalVotos = votos.length;
    const pessoTotalVotado = votos.reduce((acc, v) => acc + v.peso, 0);

    // Tally votes by opcao
    const tally: Record<string, number> = { sim: 0, nao: 0, abstencao: 0 };
    for (const voto of votos) {
      const key = voto.opcao as string;
      tally[key] = (tally[key] ?? 0) + voto.peso;
    }

    // Check quorum based on criterioVoto
    let quorumAtingido = false;
    if (item.criterioVoto === "por_unidade") {
      const percentualVotado = totalUnidades > 0
        ? (totalVotos / totalUnidades) * 100
        : 0;
      quorumAtingido = percentualVotado >= item.quorumMinimo;
    } else {
      // por_fracao
      const percentualFracaoVotado = totalFracaoIdeal > 0
        ? (pessoTotalVotado / totalFracaoIdeal) * 100
        : 0;
      quorumAtingido = percentualFracaoVotado >= item.quorumMinimo;
    }

    // Determine resultado
    let resultado: OpcaoVoto | null = null;
    let statusItem: string | null = null;

    if (!quorumAtingido) {
      resultado = null;
      statusItem = "sem_quorum";
    } else {
      // Majority wins (sim vs nao, abstencao doesn't count for decision)
      const simPeso = tally["sim"] ?? 0;
      const naoPeso = tally["nao"] ?? 0;
      const abstencaoPeso = tally["abstencao"] ?? 0;

      if (simPeso > naoPeso) {
        resultado = "sim";
      } else if (naoPeso > simPeso) {
        resultado = "nao";
      } else if (abstencaoPeso > 0) {
        // Tie defaults to abstencao
        resultado = "abstencao";
      } else {
        resultado = null;
      }
    }

    // Update ItemPauta resultado in DB
    await prisma.itemPauta.update({
      where: { id: item.id },
      data: {
        resultado: resultado,
        ...(statusItem !== null ? {} : {}),
      },
    });

    resultados.push({
      itemPautaId: item.id,
      titulo: item.titulo,
      totalVotos,
      pessoTotalVotado,
      quorumAtingido,
      resultado,
      tally,
    });
  }

  // Update assembleia status to apurada
  await db.assembleia.update({
    where: { id: input.assembleiaId },
    data: { status: "apurada" },
  });

  // Generate Ata
  const ataConteudo = gerarConteudoAta(assembleia.titulo, assembleia.dataHora, resultados);
  await prisma.ata.upsert({
    where: { assembleiaId: input.assembleiaId },
    create: {
      assembleiaId: input.assembleiaId,
      conteudo: ataConteudo,
    },
    update: {
      conteudo: ataConteudo,
    },
  });

  return {
    assembleiaId: input.assembleiaId,
    itens: resultados,
  };
}

function gerarConteudoAta(
  titulo: string,
  dataHora: Date,
  resultados: ResultadoItemPauta[]
): string {
  const dataFormatada = dataHora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const linhasItens = resultados.map((item) => {
    const status = item.quorumAtingido
      ? `Resultado: ${item.resultado ?? "indeterminado"}`
      : "Quórum não atingido";
    return `- ${item.titulo}: ${status} (votos: sim=${item.tally["sim"] ?? 0}, não=${item.tally["nao"] ?? 0}, abstenção=${item.tally["abstencao"] ?? 0})`;
  });

  return [
    `ATA DE ASSEMBLEIA`,
    ``,
    `Título: ${titulo}`,
    `Data: ${dataFormatada}`,
    ``,
    `PAUTA E RESULTADOS:`,
    ...linhasItens,
    ``,
    `Ata gerada automaticamente em ${new Date().toLocaleDateString("pt-BR")}.`,
  ].join("\n");
}
