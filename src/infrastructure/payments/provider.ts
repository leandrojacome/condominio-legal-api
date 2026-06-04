// PaymentProvider interface — isolated port per ARD §3.5
// Swap provider by changing the implementation, not the interface.

export interface BoletoParams {
  cobrancaId: string;
  valor: number;
  vencimento: Date;
  devedor: {
    nome: string;
    cpfCnpj: string;
  };
  descricao?: string;
}

export interface BoletoResult {
  externalId: string;       // nosso número
  linhaDigitavel: string;
  codigoBarras: string;
  dataVencimento: Date;
}

export interface PixParams {
  cobrancaId: string;
  valor: number;
  vencimento: Date;
  devedor: {
    nome: string;
    cpf: string;
  };
  descricao?: string;
}

export interface PixResult {
  externalId: string;       // txid
  qrCode: string;           // copia-e-cola
  qrCodeBase64: string;
  vencimento: Date;
}

export interface PaymentProvider {
  criarCobrancaBoleto(params: BoletoParams): Promise<BoletoResult>;
  criarCobrancaPix(params: PixParams): Promise<PixResult>;
  cancelarCobranca(externalId: string, metodo: "boleto" | "pix"): Promise<void>;
}
