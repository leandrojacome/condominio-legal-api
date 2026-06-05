type DevedorVinculo = {
  id: string;
  userId: string;
};

type ResolverDevedorDb = {
  vinculo: {
    findFirst(args: {
      where: {
        unidadeId: string;
        ativo: true;
        papel: "responsavel_financeiro" | "proprietario";
      };
    }): Promise<DevedorVinculo | null>;
  };
};

export async function resolverDevedorPorUnidade(
  db: ResolverDevedorDb,
  unidadeId: string
): Promise<DevedorVinculo | null> {
  const responsavel = await db.vinculo.findFirst({
    where: { unidadeId, ativo: true, papel: "responsavel_financeiro" },
  });

  if (responsavel) return responsavel;

  return db.vinculo.findFirst({
    where: { unidadeId, ativo: true, papel: "proprietario" },
  });
}
