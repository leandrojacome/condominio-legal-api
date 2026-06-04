import { prisma, getPrismaWithTenant } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export interface CriarReservaInput {
  condominioId: string;
  userId: string;
  /** If omitted the user's active vinculo unidade is used */
  unidadeId?: string;
  areaComumId: string;
  inicio: string | Date; // ISO datetime string or Date
  fim: string | Date;    // ISO datetime string or Date
}

export async function criarReserva(input: CriarReservaInput) {
  const { condominioId, userId, areaComumId } = input;
  const db = getPrismaWithTenant(condominioId);

  const inicioDate = new Date(input.inicio);
  const fimDate = new Date(input.fim);

  if (fimDate <= inicioDate) {
    throw new AppError("VALIDATION_ERROR", "fim deve ser posterior a inicio");
  }

  // 1. Verify user has active vinculo in this condominio; optionally scoped to unidade
  const vinculo = await db.vinculo.findFirst({
    where: {
      userId,
      ativo: true,
      ...(input.unidadeId ? { unidadeId: input.unidadeId } : {}),
    },
  });
  if (!vinculo) {
    throw new AppError("FORBIDDEN", "Usuário não possui vínculo ativo neste condomínio");
  }

  const unidadeId = input.unidadeId ?? vinculo.unidadeId;

  // 2. Check inadimplência — authoritative check via Financeiro (ARD §5, spec requirement)
  const cobrancaEmAtraso = await db.cobranca.findFirst({
    where: { unidadeId, status: "em_atraso" },
  });
  if (cobrancaEmAtraso) {
    throw new AppError("UNPROCESSABLE", "Unidade inadimplente não pode realizar reservas");
  }

  // 3. Get area comum (must be active and belong to condominio)
  const area = await db.areaComum.findFirst({
    where: { id: areaComumId, ativa: true },
  });
  if (!area) {
    throw new AppError("NOT_FOUND", "Área comum não encontrada ou inativa");
  }

  // 4. Check antecedência mínima
  const now = new Date();
  const horasAteInicio = (inicioDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (horasAteInicio < area.antecedenciaMinimaHoras) {
    throw new AppError(
      "UNPROCESSABLE",
      `Reserva exige antecedência mínima de ${area.antecedenciaMinimaHoras} horas`
    );
  }

  // 5. Check antecedência máxima
  const diasAteInicio = horasAteInicio / 24;
  if (diasAteInicio > area.antecedenciaMaximaDias) {
    throw new AppError(
      "UNPROCESSABLE",
      `Reserva não pode ser feita com mais de ${area.antecedenciaMaximaDias} dias de antecedência`
    );
  }

  // 6. Check limite por unidade — calendar month of inicio (spec example: "1 per month")
  const startOfMonth = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), 1);
  const startOfNextMonth = new Date(inicioDate.getFullYear(), inicioDate.getMonth() + 1, 1);
  const reservasNoMes = await db.reserva.count({
    where: {
      areaComumId,
      unidadeId,
      status: { in: ["confirmada", "pendente"] },
      inicio: { gte: startOfMonth, lt: startOfNextMonth },
    },
  });
  if (reservasNoMes >= area.limiteReservasPorUnidade) {
    throw new AppError(
      "UNPROCESSABLE",
      `Limite de reservas por unidade atingido neste mês (máx ${area.limiteReservasPorUnidade})`
    );
  }

  // 7. Conflict check with SELECT FOR UPDATE + create reservation (+ optional charge)
  // ARD §3.7: pessimistic lock on AreaComum serializes concurrent requests for same area
  const reserva = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AreaComum" WHERE id = ${areaComumId} FOR UPDATE`;

    // Overlap: [inicio, fim) intersects [r.inicio, r.fim) when inicio < r.fim AND fim > r.inicio
    const overlapping = await tx.reserva.findMany({
      where: {
        condominioId,
        areaComumId,
        status: { in: ["confirmada", "pendente"] },
        inicio: { lt: fimDate },
        fim: { gt: inicioDate },
      },
    });

    if (area.politicaConflito === "exclusiva" && overlapping.length > 0) {
      throw new AppError("CONFLICT", "Área não disponível para o período solicitado");
    }

    if (area.politicaConflito === "capacidade") {
      const capacity = area.capacidade ?? 1;
      if (overlapping.length >= capacity) {
        throw new AppError("CONFLICT", "Capacidade da área esgotada para o período solicitado");
      }
    }

    const status = area.modoAprovacao === "automatica" ? "confirmada" : "pendente";

    let novaReserva = await tx.reserva.create({
      data: {
        condominioId,
        areaComumId,
        unidadeId,
        inicio: inicioDate,
        fim: fimDate,
        status,
      },
    });

    // Create charge in Financeiro if confirmed and area has taxa (ARD §5)
    if (status === "confirmada" && area.taxaUso && area.taxaUso > 0) {
      const competencia = `${inicioDate.getFullYear()}-${String(inicioDate.getMonth() + 1).padStart(2, "0")}`;
      const cobranca = await tx.cobranca.create({
        data: {
          condominioId,
          unidadeId,
          tipo: "consumo",
          valor: area.taxaUso,
          competencia,
          vencimento: inicioDate,
          descricao: `Taxa de uso — ${area.nome}`,
        },
      });

      novaReserva = await tx.reserva.update({
        where: { id: novaReserva.id },
        data: { cobrancaId: cobranca.id },
      });
    }

    return novaReserva;
  });

  return reserva;
}
