/**
 * Migration smoke test — requires Docker (Testcontainers).
 * Skipped automatically when Docker is unavailable (CI sets up Docker).
 *
 * Acceptance criteria: "migração inicial aplica em banco efêmero (Testcontainers)"
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import path from "path";

const DOCKER_AVAILABLE = await checkDockerAvailable();

async function checkDockerAvailable(): Promise<boolean> {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!DOCKER_AVAILABLE)(
  "Prisma migration on ephemeral PostgreSQL (Testcontainers)",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let container: any;
    let dbUrl: string;

    beforeAll(async () => {
      const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
      container = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("condominio_test")
        .withUsername("test")
        .withPassword("test")
        .start();

      dbUrl = container.getConnectionUri();
    }, 90_000);

    afterAll(async () => {
      await container?.stop();
    });

    it("applies initial migration without errors", () => {
      expect(dbUrl).toBeTruthy();

      const prismaBin = path.join(
        process.cwd(),
        "node_modules",
        ".bin",
        "prisma"
      );

      expect(() => {
        execSync(`${prismaBin} migrate deploy`, {
          env: {
            ...process.env,
            DATABASE_URL: dbUrl,
            DIRECT_URL: dbUrl,
          },
          stdio: "pipe",
          cwd: process.cwd(),
        });
      }).not.toThrow();
    });

    it("can connect and query after migration", async () => {
      const { PrismaClient } = await import("@prisma/client");
      const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });

      try {
        // If migration applied correctly, this query succeeds
        const result = await client.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM information_schema.tables
          WHERE table_schema = 'public'
        `;
        expect(Number(result[0]?.count)).toBeGreaterThan(0);
      } finally {
        await client.$disconnect();
      }
    });
  }
);
