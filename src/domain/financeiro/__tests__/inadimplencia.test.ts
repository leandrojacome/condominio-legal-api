import { describe, it, expect } from "vitest";
import { calcularEncargos } from "../inadimplencia";

describe("calcularEncargos", () => {
  it("returns zero encargos when not overdue", () => {
    const result = calcularEncargos({
      valorPrincipal: 1000,
      vencimento: new Date("2026-06-10"),
      dataReferencia: new Date("2026-06-10"),
      multaPercentual: 2,
      jurosMensalPercentual: 1,
    });
    expect(result.multa).toBe(0);
    expect(result.juros).toBe(0);
    expect(result.totalDevido).toBe(1000);
    expect(result.diasAtraso).toBe(0);
  });

  it("calculates multa + juros for 30 days late", () => {
    const result = calcularEncargos({
      valorPrincipal: 1000,
      vencimento: new Date("2026-05-01"),
      dataReferencia: new Date("2026-05-31"),
      multaPercentual: 2,
      jurosMensalPercentual: 1,
    });
    expect(result.diasAtraso).toBe(30);
    expect(result.multa).toBe(20);         // 2% of 1000
    expect(result.juros).toBe(10);         // 1% monthly = 1%/month for 1 month
    expect(result.totalDevido).toBe(1030);
  });

  it("calculates partial month juros correctly", () => {
    const result = calcularEncargos({
      valorPrincipal: 1000,
      vencimento: new Date("2026-05-01"),
      dataReferencia: new Date("2026-05-16"),
      multaPercentual: 2,
      jurosMensalPercentual: 1,
    });
    expect(result.diasAtraso).toBe(15);
    expect(result.multa).toBe(20);
    // juros = 1000 * (1%/30) * 15 = 5
    expect(result.juros).toBe(5);
  });
});
