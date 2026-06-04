import { PrismaClient } from "@prisma/client";
import { TENANT_SCOPED_MODELS } from "@/lib/tenant/constants";

// Singleton Prisma client per Next.js convention (avoid multiple instances in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Returns an extended Prisma client with tenant isolation applied.
 * Automatically injects condominioId into queries on tenant-scoped models.
 * Use this in route handlers, never raw `prisma` directly.
 */
export function getPrismaWithTenant(condominioId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string | undefined;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (
            model !== undefined &&
            (TENANT_SCOPED_MODELS as readonly string[]).includes(model)
          ) {
            if (
              operation === "findMany" ||
              operation === "findFirst" ||
              operation === "count" ||
              operation === "findFirstOrThrow" ||
              operation === "findUniqueOrThrow"
            ) {
              args["where"] = { ...(args["where"] as object | undefined), condominioId };
            } else if (operation === "create") {
              args["data"] = { ...(args["data"] as object | undefined), condominioId };
            } else if (operation === "update" || operation === "delete") {
              args["where"] = { ...(args["where"] as object | undefined), condominioId };
            }
          }
          return query(args);
        },
      },
    },
  });
}
