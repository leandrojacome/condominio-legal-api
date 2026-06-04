import { getPrismaWithTenant, prisma } from "@/infrastructure/db/client";
import { AppError } from "@/lib/errors";

export interface CriarReservaInput {
  condominioId: string;
  userId: string;
  areaComumId: string;
  inicio: Date;
  fim: Date;
}

export async function criarReserva(input: CriarReservaInput) {
  const db = getPrismaWithTenant(input.condominioId);

  // 1. Find the user's active vinculo in this condominio
  const vinculo = await db.vinculo.findFirst({
    where: {
      userId: input.userId,
      ativo: true,
    },
  });

  if (!vinculo) {
    throw new AppError("FORBIDDEN", "Usuário não possui vínculo ativo neste condomínio");
  }

  // 2. Check inadimplência
  if (vinculo.inadimplente) {
    throw new AppError("FORBIDDEN", "Inadimplente não pode reservar");
  }

  // 3. Fetch the area comum
  const area = await db.areaComum.findFirst({
    where: { id: input.areaComumId },
  });

  if (!area) {
    throw new AppError("NOT_FOUND", "Área comum não encontrada");
  }

  if (!area.ativa) {
    throw new AppError("UNPROCESSABLE", "Área comum inativa");
  }

  const now = new Date();

  // 4. Check antecedência mínima
  const diffHorasInicio =
    (input.inicio.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHorasInicio < area.antecedenciaMinimaHoras) {
    throw new AppError(
      "UNPROCESSABLE",
      `Reserva deve ser feita com antecedência mínima de ${area.antecedenciaMinimaHoras} horas`
    );
  }

  // 5. Check antecedência máxima
  const diffDiasInicio =
    (input.inicio.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDiasInicio > area.antecedenciaMaximaDias) {
    throw new AppError(
      "UNPROCESSABLE",
      `Reserva não pode ser feita com mais de ${area.antecedenciaMaximaDias} dias de antecedência`
    );
  }

  // 6. Check limite de reservas por unidade no período (confirmadas ou pendentes)
  if (area.limiteReservasPorUnidade > 0) {
    const reservasExistentes = await db.reserva.count({
      where: {
        unidadeId: vinculo.unidadeId,
        areaComumId: input.areaComumId,
        status: { in: ["confirmada", "pendente"] },
        inicio: { gte: input.inicio },
      },
    });

    if (reservasExistentes >= area.limiteReservasPorUnidade) {
      throw new AppError(
        "CONFLICT",
        `Limite de ${area.limiteReservasPorUnidade} reserva(s) por unidade atingido`
      );
    }
  }

  // 7. Conflict check and reservation creation
  let reserva;

  if (area.politicaConflito === "exclusiva") {
    // Use transaction with conflict check for exclusiva
    reserva = await prisma.$transaction(async (tx) => {
      const conflito = await tx.reserva.findFirst({
        where: {
          condominioId: input.condominioId,
          areaComumId: input.areaComumId,
          status: "confirmada",
          inicio: { lt: input.fim },
          fim: { gt: input.inicio },
        },
      });

      if (conflito) {
        throw new AppError(
          "CONFLICT",
          "Horário já reservado para esta área comum"
        );
      }

      const status =
        area.modoAprovacao === "automatica" ? "confirmada" : "pendente";

      const novaReserva = await tx.reserva.create({
        data: {
          condominioId: input.condominioId,
          areaComumId: input.areaComumId,
          unidadeId: vinculo.unidadeId,
          inicio: input.inicio,
          fim: input.fim,
          status,
        },
      });

      return novaReserva;
    });
  } else {
    // politicaConflito === "capacidade"
    const ocupadas = await db.reserva.count({
      where: {
        areaComumId: input.areaComumId,
        status: "confirmada",
        inicio: { lt: input.fim },
        fim: { gt: input.inicio },
      },
    });

    const capacidade = area.capacidade ?? 1;
    if (ocupadas >= capacidade) {
      throw new AppError(
        "CONFLICT",
        "Capacidade máxima da área comum atingida para o período"
      );
    }

    const status =
      area.modoAprovacao === "automatica" ? "confirmada" : "pendente";

    reserva = await db.reserva.create({
      data: {
        condominioId: input.condominioId,
        areaComumId: input.areaComumId,
        unidadeId: vinculo.unidadeId,
        inicio: input.inicio,
        fim: input.fim,
        status,
      },
    });
  }

  // 8. If taxaUso > 0 and status = confirmada, create a Cobrança
  if (
    reserva.status === "confirmada" &&
    area.taxaUso !== null &&
    area.taxaUso !== undefined &&
    area.taxaUso > 0
  ) {
    const hoje = new Date();
    const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    const cobranca = await db.cobranca.create({
      data: {
        condominioId: input.condominioId,
        unidadeId: vinculo.unidadeId,
        tipo: "consumo",
        valor: area.taxaUso,
        competencia,
        vencimento: input.inicio,
        descricao: `Taxa de uso: ${area.nome}`,
      },
    });

    // Link cobrança to reserva
    const dbRaw = getPrismaWithTenant(input.condominioId);
    const reservaAtualizada = await dbRaw.reserva.update({
      where: { id: reserva.id },
      data: { cobrancaId: cobranca.id },
    });

    return reservaAtualizada;
  }

  return reserva;
}
