import { getPrismaWithTenant } from "@/infrastructure/db/client";

export interface ListarComunicadosParams {
  condominioId: string;
  userId: string;
  // Optional: filter to only comunicados addressed to this user (destinatário)
  soMeus?: boolean;
  page?: number;
  perPage?: number;
}

export async function listarComunicados({
  condominioId,
  userId,
  soMeus = false,
  page = 1,
  perPage = 20,
}: ListarComunicadosParams) {
  const db = getPrismaWithTenant(condominioId);
  const skip = (page - 1) * perPage;

  const where = soMeus
    ? { condominioId, entregas: { some: { destinatarioId: userId } } }
    : { condominioId };

  const [total, comunicados] = await Promise.all([
    db.comunicado.count({ where }),
    db.comunicado.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip,
      take: perPage,
      include: {
        entregas: {
          where: { destinatarioId: userId },
          select: { canal: true, status: true, dataCiencia: true },
        },
      },
    }),
  ]);

  return { comunicados, total, page, perPage };
}
