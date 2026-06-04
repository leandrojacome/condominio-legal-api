/**
 * Cadastro module integration tests — requires Docker (Testcontainers).
 *
 * Acceptance criteria (CODAA-29):
 * - CRUD de unidades/pessoas/vínculos com isolamento por tenant testado
 * - Cross-tenant: recursos de outro tenant ficam invisíveis (resultando em 403 no handler)
 * - CPF duplicado por condomínio rejeitado; mesmo CPF em condomínios distintos é permitido
 *
 * Skipped automatically when Docker is unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { TENANT_SCOPED_MODELS } from "@/lib/tenant/constants";

const DOCKER_AVAILABLE = await checkDockerAvailable();

async function checkDockerAvailable(): Promise<boolean> {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Replicates the getPrismaWithTenant extension for test-local PrismaClient instances.
 * Keeps tests independent of the global singleton in infrastructure/db/client.ts.
 */
function withTenant(base: PrismaClient, condominioId: string) {
  return base.$extends({
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
              ["findMany", "findFirst", "count", "findFirstOrThrow", "findUniqueOrThrow"].includes(
                operation
              )
            ) {
              args["where"] = { ...(args["where"] as object | undefined), condominioId };
            } else if (operation === "create") {
              args["data"] = { ...(args["data"] as object | undefined), condominioId };
            } else if (["update", "delete"].includes(operation)) {
              args["where"] = { ...(args["where"] as object | undefined), condominioId };
            }
          }
          return query(args);
        },
      },
    },
  });
}

describe.skipIf(!DOCKER_AVAILABLE)(
  "Cadastro — tenant isolation + CPF uniqueness (Testcontainers)",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let container: any;
    let dbUrl: string;
    let client: PrismaClient;

    beforeAll(async () => {
      const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
      container = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("cadastro_test")
        .withUsername("test")
        .withPassword("test")
        .start();

      dbUrl = container.getConnectionUri();

      const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
      execSync(`${prismaBin} migrate deploy`, {
        env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
        stdio: "pipe",
        cwd: process.cwd(),
      });

      client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    }, 120_000);

    afterAll(async () => {
      await client?.$disconnect();
      await container?.stop();
    });

    // ── Condomínio CRUD ───────────────────────────────────────────────────────

    describe("Condomínio — CRUD básico", () => {
      it("cria condomínio com dados mínimos", async () => {
        const c = await client.condominio.create({
          data: { nome: "Edifício Smoke", cnpj: "00000000000191", endereco: "Rua Zero, 1" },
        });
        expect(c.id).toBeTruthy();
        expect(c.nome).toBe("Edifício Smoke");
        expect(c.cnpj).toBe("00000000000191");
      });

      it("busca condomínio por id", async () => {
        const created = await client.condominio.create({
          data: { nome: "Edifício Busca", cnpj: "10000000000172", endereco: "Av. Busca, 10" },
        });
        const found = await client.condominio.findUnique({ where: { id: created.id } });
        expect(found?.id).toBe(created.id);
      });

      it("atualiza nome do condomínio", async () => {
        const c = await client.condominio.create({
          data: { nome: "Nome Antigo", cnpj: "20000000000153", endereco: "Rua Atualiza, 5" },
        });
        const updated = await client.condominio.update({
          where: { id: c.id },
          data: { nome: "Nome Novo" },
        });
        expect(updated.nome).toBe("Nome Novo");
      });
    });

    // ── Tenant isolation ──────────────────────────────────────────────────────

    describe("Isolamento multi-tenant", () => {
      let condominioAId: string;
      let condominioBId: string;

      beforeAll(async () => {
        const [a, b] = await Promise.all([
          client.condominio.create({
            data: { nome: "Tenant A", cnpj: "31111111000110", endereco: "Rua A, 1" },
          }),
          client.condominio.create({
            data: { nome: "Tenant B", cnpj: "42222222000120", endereco: "Rua B, 2" },
          }),
        ]);
        condominioAId = a.id;
        condominioBId = b.id;
      });

      it("unidades: tenant A não enxerga unidades de tenant B", async () => {
        const dbA = withTenant(client, condominioAId);
        const dbB = withTenant(client, condominioBId);

        await dbB.unidade.create({
          data: { condominioId: condominioBId, numero: "B-101" },
        });

        const fromA = await dbA.unidade.findMany({});
        expect(
          fromA.every((u: { condominioId: string }) => u.condominioId === condominioAId)
        ).toBe(true);
        const leaked = fromA.find(
          (u: { condominioId: string }) => u.condominioId === condominioBId
        );
        expect(leaked).toBeUndefined();
      });

      it("pessoas: findFirst por id de outro tenant retorna null", async () => {
        const dbA = withTenant(client, condominioAId);
        const dbB = withTenant(client, condominioBId);

        const pessoaB = await dbB.pessoa.create({
          data: {
            condominioId: condominioBId,
            nome: "Pessoa de B",
            cpf: "55544433322",
            email: "b@example.com",
            telefone: "11900000099",
          },
        });

        // Tenant A should not find tenant B's pessoa (this drives the 403 in the handler)
        const fromA = await dbA.pessoa.findFirst({ where: { id: pessoaB.id } });
        expect(fromA).toBeNull();
      });

      it("vínculos: tenant A não lista vínculos de tenant B", async () => {
        const dbA = withTenant(client, condominioAId);
        const dbB = withTenant(client, condominioBId);

        // Create User required for Vinculo FK
        const userB = await client.user.create({
          data: { email: "userb@example.com", name: "User B" },
        });

        const unidadeB = await dbB.unidade.create({
          data: { condominioId: condominioBId, numero: "B-201" },
        });
        const pessoaB = await dbB.pessoa.create({
          data: {
            condominioId: condominioBId,
            nome: "Pessoa B2",
            cpf: "66655544433",
            email: "b2@example.com",
            telefone: "11900000088",
          },
        });
        await dbB.vinculo.create({
          data: {
            condominioId: condominioBId,
            userId: userB.id,
            pessoaId: pessoaB.id,
            unidadeId: unidadeB.id,
            papel: "proprietario",
            perfil: "proprietario",
          },
        });

        const fromA = await dbA.vinculo.findMany({});
        expect(
          fromA.every((v: { condominioId: string }) => v.condominioId === condominioAId)
        ).toBe(true);
      });
    });

    // ── CPF uniqueness per condomínio ─────────────────────────────────────────

    describe("CPF único por condomínio (ARD §5)", () => {
      let condominioXId: string;
      let condominioYId: string;

      beforeAll(async () => {
        const [x, y] = await Promise.all([
          client.condominio.create({
            data: { nome: "Cond X", cnpj: "53333333000130", endereco: "Rua X, 1" },
          }),
          client.condominio.create({
            data: { nome: "Cond Y", cnpj: "64444444000140", endereco: "Rua Y, 2" },
          }),
        ]);
        condominioXId = x.id;
        condominioYId = y.id;
      });

      it("mesmo CPF em condomínios diferentes é permitido", async () => {
        const dbX = withTenant(client, condominioXId);
        const dbY = withTenant(client, condominioYId);

        const cpf = "12312312312";
        await dbX.pessoa.create({
          data: {
            condominioId: condominioXId,
            nome: "Duplicado X",
            cpf,
            email: "cpf@x.com",
            telefone: "11911111111",
          },
        });
        const inY = await dbY.pessoa.create({
          data: {
            condominioId: condominioYId,
            nome: "Duplicado Y",
            cpf,
            email: "cpf@y.com",
            telefone: "11922222222",
          },
        });
        expect(inY.id).toBeTruthy();
      });

      it("CPF duplicado no mesmo condomínio é rejeitado", async () => {
        const dbX = withTenant(client, condominioXId);
        const cpf = "98798798798";

        await dbX.pessoa.create({
          data: {
            condominioId: condominioXId,
            nome: "Original",
            cpf,
            email: "orig@x.com",
            telefone: "11933333333",
          },
        });

        await expect(
          dbX.pessoa.create({
            data: {
              condominioId: condominioXId,
              nome: "Duplicata",
              cpf,
              email: "dup@x.com",
              telefone: "11944444444",
            },
          })
        ).rejects.toThrow();
      });
    });

    // ── Unidade CRUD ──────────────────────────────────────────────────────────

    describe("Unidade — CRUD e unicidade bloco+número", () => {
      let condominioId: string;

      beforeAll(async () => {
        const c = await client.condominio.create({
          data: { nome: "Cond Unidades", cnpj: "75555555000150", endereco: "Rua U, 1" },
        });
        condominioId = c.id;
      });

      it("cria unidade com bloco e número", async () => {
        const db = withTenant(client, condominioId);
        const u = await db.unidade.create({
          data: { condominioId, bloco: "B", numero: "302", tipo: "APARTAMENTO" },
        });
        expect(u.bloco).toBe("B");
        expect(u.numero).toBe("302");
        expect(u.tipo).toBe("APARTAMENTO");
      });

      it("duplicata bloco+número no mesmo condomínio é rejeitada", async () => {
        const db = withTenant(client, condominioId);
        await db.unidade.create({
          data: { condominioId, bloco: "C", numero: "401" },
        });
        await expect(
          db.unidade.create({
            data: { condominioId, bloco: "C", numero: "401" },
          })
        ).rejects.toThrow();
      });
    });

    // ── Vínculo CRUD ──────────────────────────────────────────────────────────

    describe("Vínculo — criação e papéis", () => {
      let condominioId: string;

      beforeAll(async () => {
        const c = await client.condominio.create({
          data: { nome: "Cond Vinculos", cnpj: "86666666000160", endereco: "Rua V, 1" },
        });
        condominioId = c.id;
      });

      it("cria vínculo proprietário↔unidade com sucesso", async () => {
        const db = withTenant(client, condominioId);
        const user = await client.user.create({
          data: { email: `vinculo-user-${condominioId}@test.com`, name: "Vínculo User" },
        });
        const unidade = await db.unidade.create({
          data: { condominioId, bloco: "A", numero: "101" },
        });
        const pessoa = await db.pessoa.create({
          data: {
            condominioId,
            nome: "João Proprietário",
            cpf: "11122233344",
            email: "joao@test.com",
            telefone: "11955555555",
          },
        });

        const vinculo = await db.vinculo.create({
          data: {
            condominioId,
            userId: user.id,
            pessoaId: pessoa.id,
            unidadeId: unidade.id,
            papel: "proprietario",
            perfil: "proprietario",
          },
          include: { pessoa: true, unidade: true },
        });

        expect(vinculo.papel).toBe("proprietario");
        expect(vinculo.pessoa.id).toBe(pessoa.id);
        expect(vinculo.unidade.id).toBe(unidade.id);
      });
    });
  }
);
