import { prisma, getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";
import type { OpcaoVoto } from "@prisma/client";

export interface ApurarAssembleiaInput {
  condominioId: string;
  assembleiaId: string;
}

interface ResultadoItem {
  itemPautaId: string;
  titulo: string;
  criterioVoto: string;
  quorumMinimo: number;
  votoSecreto: boolean;
  quorumAtingido: boolean;
  participacao: number;
  totalElegivel: number;
  contagem: Record<OpcaoVoto, number>;
  resultado: OpcaoVoto | null;
}

export interface ApuracaoResult {
  assembleiaId: string;
  itens: ResultadoItem[];
}

export async function apurarAssembleia(input: ApurarAssembleiaInput): Promise<ApuracaoResult> {
  const db = getPrismaWithTenant(input.condominioId);

  const assembleia = await db.assembleia.findFirst({
    where: { id: input.assembleiaId },
    include: {
      itensPauta: {
        orderBy: { ordem: "asc" },
        include: { votos: true },
      },
    },
  });

  if (!assembleia) {
    throw new AppError("NOT_FOUND", "Assembleia não encontrada");
  }

  if (assembleia.status !== "votacao_encerrada") {
    throw new AppError("UNPROCESSABLE", "Votação deve estar encerrada para apuração");
  }

  // Collect all eligible vinculos (active, not inadimplente) with their unidade's fracaoIdeal
  const vinculos = await db.vinculo.findMany({
    where: { ativo: true, inadimplente: false },
    select: {
      unidadeId: true,
      unidade: { select: { fracaoIdeal: true } },
    },
  });

  // Deduplicate unidades (a unidade may have multiple vinculos)
  const unidadeMap = new Map<string, number>();
  for (const v of vinculos) {
    if (!unidadeMap.has(v.unidadeId)) {
      unidadeMap.set(v.unidadeId, v.unidade.fracaoIdeal ?? 1.0);
    }
  }

  const itensResult: ResultadoItem[] = [];

  for (const item of assembleia.itensPauta) {
    const contagem: Record<OpcaoVoto, number> = { sim: 0, nao: 0, abstencao: 0 };

    for (const voto of item.votos) {
      contagem[voto.opcao] += voto.peso;
    }

    const participacao = item.votos.reduce((acc, v) => acc + v.peso, 0);

    // Total eligible weight for this item
    let totalElegivel = 0;
    if (item.criterioVoto === "por_fracao") {
      for (const fracao of unidadeMap.values()) {
        totalElegivel += fracao;
      }
    } else {
      totalElegivel = unidadeMap.size;
    }

    const quorumAtingido =
      totalElegivel > 0 ? participacao / totalElegivel >= item.quorumMinimo / 100 : false;

    // Determine resultado (sim vs nao only; abstencao doesn't decide)
    let resultado: OpcaoVoto | null = null;
    if (quorumAtingido) {
      if (contagem.sim > contagem.nao) {
        resultado = "sim";
      } else if (contagem.nao > contagem.sim) {
        resultado = "nao";
      } else {
        // Tie — no result
        resultado = null;
      }
    }

    // Persist resultado on ItemPauta
    await prisma.itemPauta.update({
      where: { id: item.id },
      data: { resultado },
    });

    itensResult.push({
      itemPautaId: item.id,
      titulo: item.titulo,
      criterioVoto: item.criterioVoto,
      quorumMinimo: item.quorumMinimo,
      votoSecreto: item.votoSecreto,
      quorumAtingido,
      participacao,
      totalElegivel,
      // For secret items, omit per-vote identity but keep aggregate counts
      contagem: item.votoSecreto
        ? contagem
        : contagem,
      resultado,
    });
  }

  // Move assembleia to apurada
  await db.assembleia.update({
    where: { id: input.assembleiaId },
    data: { status: "apurada" },
  });

  return { assembleiaId: input.assembleiaId, itens: itensResult };
}
