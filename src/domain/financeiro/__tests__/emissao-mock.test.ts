/**
 * Tests for boleto and Pix emission using MockPaymentProvider (ARD §3.10).
 * Verifies that the provider interface returns expected shapes so route handlers
 * can persist them correctly.
 */
import { describe, it, expect } from "vitest";
import { MockPaymentProvider } from "@/infrastructure/payments/mock";

const provider = new MockPaymentProvider();
const COBRANCA_ID = "cobr-test-123";
const VENCIMENTO = new Date("2026-06-30T00:00:00.000Z");

describe("MockPaymentProvider — boleto", () => {
  it("returns expected BoletoResult shape", async () => {
    const result = await provider.criarCobrancaBoleto({
      cobrancaId: COBRANCA_ID,
      valor: 500,
      vencimento: VENCIMENTO,
      devedor: { nome: "João Silva", cpfCnpj: "123.456.789-00" },
    });

    expect(result.externalId).toBe(`boleto-${COBRANCA_ID}`);
    expect(result.linhaDigitavel).toBeTruthy();
    expect(result.codigoBarras).toBeTruthy();
    expect(result.dataVencimento).toEqual(VENCIMENTO);
  });

  it("externalId is deterministic from cobrancaId", async () => {
    const r1 = await provider.criarCobrancaBoleto({
      cobrancaId: "cobr-abc",
      valor: 100,
      vencimento: VENCIMENTO,
      devedor: { nome: "Test", cpfCnpj: "000.000.000-00" },
    });
    const r2 = await provider.criarCobrancaBoleto({
      cobrancaId: "cobr-xyz",
      valor: 100,
      vencimento: VENCIMENTO,
      devedor: { nome: "Test", cpfCnpj: "000.000.000-00" },
    });

    expect(r1.externalId).toBe("boleto-cobr-abc");
    expect(r2.externalId).toBe("boleto-cobr-xyz");
    expect(r1.externalId).not.toBe(r2.externalId);
  });
});

describe("MockPaymentProvider — Pix", () => {
  it("returns expected PixResult shape", async () => {
    const result = await provider.criarCobrancaPix({
      cobrancaId: COBRANCA_ID,
      valor: 750,
      vencimento: VENCIMENTO,
      devedor: { nome: "Maria Souza", cpf: "987.654.321-00" },
    });

    expect(result.externalId).toBe(`pix-${COBRANCA_ID}`);
    expect(result.qrCode).toBeTruthy();
    expect(result.qrCodeBase64).toBeTruthy();
    expect(result.vencimento).toEqual(VENCIMENTO);
  });

  it("qrCode is a non-empty string (copia-e-cola format)", async () => {
    const result = await provider.criarCobrancaPix({
      cobrancaId: COBRANCA_ID,
      valor: 100,
      vencimento: VENCIMENTO,
      devedor: { nome: "Test", cpf: "111.111.111-11" },
    });

    expect(typeof result.qrCode).toBe("string");
    expect(result.qrCode.length).toBeGreaterThan(10);
  });
});

describe("MockPaymentProvider — cancelarCobranca", () => {
  it("resolves without throwing", async () => {
    await expect(
      provider.cancelarCobranca(`boleto-${COBRANCA_ID}`, "boleto")
    ).resolves.toBeUndefined();
  });
});
