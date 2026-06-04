// MockPaymentProvider — deterministic stub for tests (ARD §3.10)
import type {
  PaymentProvider,
  BoletoParams,
  BoletoResult,
  PixParams,
  PixResult,
} from "./provider";

export class MockPaymentProvider implements PaymentProvider {
  async criarCobrancaBoleto(params: BoletoParams): Promise<BoletoResult> {
    return {
      externalId: `boleto-${params.cobrancaId}`,
      linhaDigitavel: "00000.00000 00000.000000 00000.000000 1 00000000000000",
      codigoBarras: "00000000000000000000000000000000000000000000",
      dataVencimento: params.vencimento,
    };
  }

  async criarCobrancaPix(params: PixParams): Promise<PixResult> {
    return {
      externalId: `pix-${params.cobrancaId}`,
      qrCode:
        "00020126330014BR.GOV.BCB.PIX0111testepix5204000053039865802BR5913COND LEGAL6008BRASILIA6304ABCD",
      qrCodeBase64: "data:image/png;base64,bW9ja3FyY29kZQ==",
      vencimento: params.vencimento,
    };
  }

  async cancelarCobranca(_externalId: string, _metodo: "boleto" | "pix"): Promise<void> {
    // no-op in mock
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
