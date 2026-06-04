// Prisma model names that are scoped to a condomínio.
// Only models with a direct condominioId field belong here.
// These receive automatic condominioId injection in getPrismaWithTenant().
export const TENANT_SCOPED_MODELS = [
  "Unidade",
  "Pessoa",
  "Vinculo",
  "Cobranca",
  "Comunicado",
  "AreaComum",
  "Reserva",
  "Assembleia",
  "Ocorrencia",
  "RegistroAcesso",
  "PreAutorizacao",
  "Encomenda",
] as const;
