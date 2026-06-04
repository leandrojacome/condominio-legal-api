import { getPrismaWithTenant } from "@/infrastructure/db/client";
import type { ConsultarHistoricoQuery } from "@/domain/portaria/schemas";
import { buildPage, DEFAULT_PAGE_LIMIT } from "@/lib/pagination";

export async function consultarHistoricoAcessos(
  condominioId: string,
  query: ConsultarHistoricoQuery
) {
  const db = getPrismaWithTenant(condominioId);
  const limit = query.limit ?? DEFAULT_PAGE_LIMIT;

  const where: Record<string, unknown> = {};
  if (query.unidadeId) where["unidadeDestinoId"] = query.unidadeId;
  if (query.de || query.ate) {
    where["criadoEm"] = {
      ...(query.de ? { gte: new Date(query.de) } : {}),
      ...(query.ate ? { lte: new Date(query.ate) } : {}),
    };
  }
  if (query.cursor) {
    where["id"] = { gt: query.cursor };
  }

  const items = await db.registroAcesso.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take: limit + 1,
  });

  return buildPage(items, limit);
}

export async function consultarHistoricoEncomendas(
  condominioId: string,
  query: ConsultarHistoricoQuery
) {
  const db = getPrismaWithTenant(condominioId);
  const limit = query.limit ?? DEFAULT_PAGE_LIMIT;

  const where: Record<string, unknown> = {};
  if (query.unidadeId) where["unidadeDestinoId"] = query.unidadeId;
  if (query.de || query.ate) {
    where["recebidaEm"] = {
      ...(query.de ? { gte: new Date(query.de) } : {}),
      ...(query.ate ? { lte: new Date(query.ate) } : {}),
    };
  }
  if (query.cursor) {
    where["id"] = { gt: query.cursor };
  }

  const items = await db.encomenda.findMany({
    where,
    orderBy: { recebidaEm: "desc" },
    take: limit + 1,
  });

  return buildPage(items, limit);
}
