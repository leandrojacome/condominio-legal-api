import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPrismaWithTenant } from "@/infrastructure/db/client";
import { prisma } from "@/infrastructure/db/client";
import { forbiddenError, notFoundError, handleRouteError } from "@/lib/errors";
import { requirePerfil } from "@/lib/auth/rbac";
import { PerfilUsuario } from "@/domain/cadastro/perfil";
import type { RouteContext } from "@/lib/auth/rbac";

// GET — audit trail; respects votoSecreto (hides unidadeVotanteId for secret items)
export const GET = requirePerfil(
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.CONSELHO,
)(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const params = await ctx.params;
    const condominioId = params["id"] as string;
    const assembleiaId = params["assembleiaId"] as string;
    const tenantCtx = await getTenantContext();

    if (condominioId !== tenantCtx.condominioId) {
      return forbiddenError("Access denied") as unknown as Response;
    }

    const db = getPrismaWithTenant(tenantCtx.condominioId);

    const assembleia = await db.assembleia.findFirst({
      where: { id: assembleiaId },
      include: { itensPauta: true },
    });

    if (!assembleia) {
      return notFoundError("Assembleia") as unknown as Response;
    }

    // Build a set of secret item IDs to mask identity in audit records
    const secretItemIds = new Set(
      assembleia.itensPauta
        .filter((item) => item.votoSecreto)
        .map((item) => item.id)
    );

    const registros = await prisma.votoAuditoria.findMany({
      where: {
        itemPautaId: {
          in: assembleia.itensPauta.map((i) => i.id),
        },
      },
      orderBy: { votadoEm: "asc" },
    });

    // For secret items, strip unidadeVotanteId
    const resultado = registros.map((r) => {
      if (secretItemIds.has(r.itemPautaId)) {
        return {
          id: r.id,
          itemPautaId: r.itemPautaId,
          unidadeVotanteId: null,  // masked for secret items
          opcao: r.opcao,
          peso: r.peso,
          votadoEm: r.votadoEm,
        };
      }
      return r;
    });

    return NextResponse.json(resultado);
  } catch (err) {
    return handleRouteError(err) as unknown as Response;
  }
});
