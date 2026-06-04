// Prisma model names that are scoped to a condomínio.
// These receive automatic condominioId injection in getPrismaWithTenant().
export const TENANT_SCOPED_MODELS = [
  "Unidade",
  "Pessoa",
  "Vinculo",
  "Cobranca",
  "Pagamento",
  "Aviso",
  "Reserva",
  "Assembleia",
  "Ocorrencia",
  "RegistroAcesso",
  "Encomenda",
] as const;
