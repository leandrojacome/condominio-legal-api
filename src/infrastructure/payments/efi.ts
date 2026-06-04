import type {
  PaymentProvider,
  BoletoParams,
  BoletoResult,
  PixParams,
  PixResult,
} from "./provider";

// Efí Bank (Gerencianet) PSP adapter per ARD §3.5
// Production: uses sdk-node-apis-efi with mTLS cert
// Sandbox: EFI_SANDBOX=true routes to Efí sandbox environment
export class EfiPaymentProvider implements PaymentProvider {
  async criarCobrancaBoleto(params: BoletoParams): Promise<BoletoResult> {
    // TODO: integrate sdk-node-apis-efi for boleto registration
    // Stub for compile-time verification; real impl in follow-up
    throw new Error(
      `EfiPaymentProvider.criarCobrancaBoleto not yet implemented for cobrancaId=${params.cobrancaId}`
    );
  }

  async criarCobrancaPix(params: PixParams): Promise<PixResult> {
    // TODO: integrate sdk-node-apis-efi for Pix COB/COBV
    throw new Error(
      `EfiPaymentProvider.criarCobrancaPix not yet implemented for cobrancaId=${params.cobrancaId}`
    );
  }

  async cancelarCobranca(externalId: string, metodo: "boleto" | "pix"): Promise<void> {
    // TODO: cancel/refund via Efí Bank API
    throw new Error(
      `EfiPaymentProvider.cancelarCobranca not yet implemented for externalId=${externalId}, metodo=${metodo}`
    );
  }
}

export const paymentProvider: PaymentProvider = new EfiPaymentProvider();
