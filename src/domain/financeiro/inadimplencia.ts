// Domain logic for inadimplência calculations (ARD §3.7)

export interface CalculoEncargosInput {
  valorPrincipal: number;
  vencimento: Date;
  dataReferencia: Date;
  multaPercentual: number;   // e.g. 2.0 for 2%
  jurosMensalPercentual: number; // e.g. 1.0 for 1% per month
}

export interface CalculoEncargosResult {
  valorPrincipal: number;
  multa: number;
  juros: number;
  totalDevido: number;
  diasAtraso: number;
}

export function calcularEncargos({
  valorPrincipal,
  vencimento,
  dataReferencia,
  multaPercentual,
  jurosMensalPercentual,
}: CalculoEncargosInput): CalculoEncargosResult {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diasAtraso = Math.max(
    0,
    Math.floor((dataReferencia.getTime() - vencimento.getTime()) / msPerDay)
  );

  if (diasAtraso <= 0) {
    return { valorPrincipal, multa: 0, juros: 0, totalDevido: valorPrincipal, diasAtraso: 0 };
  }

  const multa = valorPrincipal * (multaPercentual / 100);
  // Juros pro-rated diários a partir do percentual mensal
  const jurosDiario = jurosMensalPercentual / 100 / 30;
  const juros = valorPrincipal * jurosDiario * diasAtraso;

  return {
    valorPrincipal,
    multa: roundCents(multa),
    juros: roundCents(juros),
    totalDevido: roundCents(valorPrincipal + multa + juros),
    diasAtraso,
  };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
