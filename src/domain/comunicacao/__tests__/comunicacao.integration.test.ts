/**
 * Comunicacao module integration tests — requires Docker (Testcontainers).
 *
 * Acceptance criteria (CODAA-31):
 * - Aviso geral entregue a todos os vínculos ativos do condomínio
 * - Aviso segmentado sem destinatarioIds rejeitado com AppError VALIDATION_ERROR
 * - Confirmação de leitura registrada com dataCiencia
 * - Status de entregas retorna lidos e pendentes corretamente
 * - Comunicado de outro condomínio não é retornado (tenant isolation)
 *
 * Skipped automatically when Docker is unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { TENANT_SCOPED_MODELS } from "@/lib/tenant/constants";
import { AppError } from "@/lib/errors";

const DOCKER_AVAILABLE = await checkDockerAvailable();

async function checkDockerAvailable(): Promise<boolean> {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

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
  "Comunicacao — entrega multicanal + confirmação de leitura + isolamento (Testcontainers)",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let container: any;
    let dbUrl: string;
    let client: PrismaClient;

    // Shared fixtures
    let condA: { id: string };
    let condB: { id: string };
    let userSindico: { id: string };
    let userMorador: { id: string };

    beforeAll(async () => {
      const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
      container = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("comunicacao_test")
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

      // Create two condominios for tenant isolation tests
      condA = await client.condominio.create({
        data: { nome: "Cond A", cnpj: "11111111000191", endereco: "Rua A, 1" },
      });
      condB = await client.condominio.create({
        data: { nome: "Cond B", cnpj: "22222222000100", endereco: "Rua B, 2" },
      });

      // Create users
      userSindico = await client.user.create({
        data: { name: "Síndico", email: "sindico@test.com" },
      });
      userMorador = await client.user.create({
        data: { name: "Morador", email: "morador@test.com" },
      });

      // Create pessoas
      const pessoaSindico = await client.pessoa.create({
        data: {
          condominioId: condA.id,
          nome: "Síndico",
          cpf: "00000000001",
          email: "sindico@cond.com",
          telefone: "11999990001",
        },
      });
      const pessoaMorador = await client.pessoa.create({
        data: {
          condominioId: condA.id,
          nome: "Morador",
          cpf: "00000000002",
          email: "morador@cond.com",
          telefone: "11999990002",
        },
      });

      // Create unidades
      const unidade1 = await client.unidade.create({
        data: { condominioId: condA.id, numero: "101", bloco: "A" },
      });

      // Create vinculos (papel uses PapelVinculo enum — sindico uses 'proprietario' papel)
      await client.vinculo.create({
        data: {
          condominioId: condA.id,
          userId: userSindico.id,
          pessoaId: pessoaSindico.id,
          unidadeId: unidade1.id,
          papel: "proprietario",
          perfil: "sindico",
          ativo: true,
        },
      });
      await client.vinculo.create({
        data: {
          condominioId: condA.id,
          userId: userMorador.id,
          pessoaId: pessoaMorador.id,
          unidadeId: unidade1.id,
          papel: "morador",
          perfil: "proprietario",
          ativo: true,
        },
      });
    }, 120_000);

    afterAll(async () => {
      await client?.$disconnect();
      await container?.stop();
    });

    // ── Publicação ────────────────────────────────────────────────────────────

    describe("Publicação de comunicados", () => {
      it("persiste aviso_geral com todos os campos", async () => {
        const db = withTenant(client, condA.id);
        const comunicado = await db.comunicado.create({
          data: {
            condominioId: condA.id,
            autorId: userSindico.id,
            titulo: "Aviso Geral Teste",
            conteudo: "Conteúdo do aviso",
            tipo: "aviso_geral",
          },
        });
        expect(comunicado.id).toBeTruthy();
        expect(comunicado.tipo).toBe("aviso_geral");
        expect(comunicado.condominioId).toBe(condA.id);
      });

      it("rejeita aviso_segmentado sem destinatarioIds (VALIDATION_ERROR)", async () => {
        // Simulates the use-case validation (schema level)
        const { CriarComunicadoSchema } = await import("@/domain/comunicacao/schemas");
        const result = CriarComunicadoSchema.safeParse({
          titulo: "Aviso Bloco B",
          conteudo: "Apenas Bloco B",
          tipo: "aviso_segmentado",
          // no destinatarioIds — this is the validation the use-case enforces
        });
        // Schema itself passes (destinatarioIds is optional at schema level),
        // but use-case throws AppError for segmentado without destinatarioIds.
        // Verify the use-case guard separately.
        const { publicarComunicado } = await import(
          "@/application/comunicacao/use-cases/publicar-comunicado"
        );
        // We inject a mock-like setup using the real db
        await expect(
          publicarComunicado(condA.id, userSindico.id, {
            titulo: "Aviso Bloco B",
            conteudo: "Apenas Bloco B",
            tipo: "aviso_segmentado",
          })
        ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      });
    });

    // ── Entrega + fila ────────────────────────────────────────────────────────

    describe("Criação de entregas", () => {
      it("cria registros de entrega por canal e destinatário", async () => {
        const db = withTenant(client, condA.id);

        const comunicado = await db.comunicado.create({
          data: {
            condominioId: condA.id,
            autorId: userSindico.id,
            titulo: "Aviso Entrega",
            conteudo: "Teste entrega multicanal",
            tipo: "aviso_geral",
          },
        });

        const canais = ["in_app", "email"] as const;
        for (const canal of canais) {
          await db.entregaComunicado.create({
            data: {
              comunicadoId: comunicado.id,
              destinatarioId: userMorador.id,
              canal,
            },
          });
        }

        const entregas = await db.entregaComunicado.findMany({
          where: { comunicadoId: comunicado.id },
        });

        expect(entregas).toHaveLength(2);
        expect(entregas.map((e) => e.canal).sort()).toEqual(["email", "in_app"]);
        expect(entregas.every((e) => e.status === "pendente")).toBe(true);
      });

      it("não duplica entrega (unique constraint comunicadoId + destinatarioId + canal)", async () => {
        const db = withTenant(client, condA.id);

        const comunicado = await db.comunicado.create({
          data: {
            condominioId: condA.id,
            autorId: userSindico.id,
            titulo: "Aviso Dedup",
            conteudo: "Teste dedup",
            tipo: "aviso_geral",
          },
        });

        await db.entregaComunicado.create({
          data: { comunicadoId: comunicado.id, destinatarioId: userMorador.id, canal: "in_app" },
        });

        await expect(
          db.entregaComunicado.create({
            data: { comunicadoId: comunicado.id, destinatarioId: userMorador.id, canal: "in_app" },
          })
        ).rejects.toThrow();
      });
    });

    // ── Confirmação de leitura ────────────────────────────────────────────────

    describe("Confirmação de leitura (ciência)", () => {
      it("registra dataCiencia ao confirmar leitura", async () => {
        const db = withTenant(client, condA.id);

        const comunicado = await db.comunicado.create({
          data: {
            condominioId: condA.id,
            autorId: userSindico.id,
            titulo: "Aviso Ciência",
            conteudo: "Leia e confirme",
            tipo: "aviso_geral",
          },
        });

        await db.entregaComunicado.create({
          data: { comunicadoId: comunicado.id, destinatarioId: userMorador.id, canal: "in_app" },
        });

        // Confirm reading
        await db.entregaComunicado.updateMany({
          where: {
            comunicadoId: comunicado.id,
            destinatarioId: userMorador.id,
            dataCiencia: null,
          },
          data: { dataCiencia: new Date() },
        });

        const entrega = await db.entregaComunicado.findFirst({
          where: { comunicadoId: comunicado.id, destinatarioId: userMorador.id },
        });

        expect(entrega?.dataCiencia).toBeTruthy();
      });

      it("confirmar segunda vez é idempotente (dataCiencia não sobrescrita)", async () => {
        const db = withTenant(client, condA.id);

        const comunicado = await db.comunicado.create({
          data: {
            condominioId: condA.id,
            autorId: userSindico.id,
            titulo: "Aviso Idempotente",
            conteudo: "Teste",
            tipo: "aviso_geral",
          },
        });

        await db.entregaComunicado.create({
          data: { comunicadoId: comunicado.id, destinatarioId: userMorador.id, canal: "in_app" },
        });

        const firstRead = new Date("2026-01-01T10:00:00Z");

        // First confirmation
        await db.entregaComunicado.updateMany({
          where: { comunicadoId: comunicado.id, destinatarioId: userMorador.id, dataCiencia: null },
          data: { dataCiencia: firstRead },
        });

        // Second confirmation attempt — where clause filters out already-read records
        const result = await db.entregaComunicado.updateMany({
          where: { comunicadoId: comunicado.id, destinatarioId: userMorador.id, dataCiencia: null },
          data: { dataCiencia: new Date() },
        });

        expect(result.count).toBe(0); // nothing updated

        const entrega = await db.entregaComunicado.findFirst({
          where: { comunicadoId: comunicado.id, destinatarioId: userMorador.id },
        });
        expect(entrega?.dataCiencia?.toISOString()).toBe(firstRead.toISOString());
      });
    });

    // ── Isolamento de tenants ─────────────────────────────────────────────────

    describe("Isolamento por condomínio", () => {
      it("comunicado do cond A não aparece em consulta do cond B", async () => {
        const dbA = withTenant(client, condA.id);
        const dbB = withTenant(client, condB.id);

        await dbA.comunicado.create({
          data: {
            condominioId: condA.id,
            autorId: userSindico.id,
            titulo: "Aviso Exclusivo A",
            conteudo: "Só para cond A",
            tipo: "aviso_geral",
          },
        });

        const comunicadosB = await dbB.comunicado.findMany();
        const titulos = comunicadosB.map((c) => c.titulo);
        expect(titulos).not.toContain("Aviso Exclusivo A");
      });
    });

    // ── Status de entregas ────────────────────────────────────────────────────

    describe("Status de entregas (lidos vs pendentes)", () => {
      it("retorna lidos e pendentes corretamente", async () => {
        const db = withTenant(client, condA.id);

        const userPendente = await client.user.create({
          data: { name: "Pendente", email: "pendente@test.com" },
        });

        const comunicado = await db.comunicado.create({
          data: {
            condominioId: condA.id,
            autorId: userSindico.id,
            titulo: "Aviso Status",
            conteudo: "Verificar status",
            tipo: "aviso_geral",
          },
        });

        await db.entregaComunicado.create({
          data: {
            comunicadoId: comunicado.id,
            destinatarioId: userMorador.id,
            canal: "in_app",
            dataCiencia: new Date(), // already read
          },
        });
        await db.entregaComunicado.create({
          data: {
            comunicadoId: comunicado.id,
            destinatarioId: userPendente.id,
            canal: "in_app",
            // no dataCiencia — pending
          },
        });

        const lidos = await db.entregaComunicado.findMany({
          where: { comunicadoId: comunicado.id, dataCiencia: { not: null } },
        });
        const pendentes = await db.entregaComunicado.findMany({
          where: { comunicadoId: comunicado.id, dataCiencia: null },
        });

        expect(lidos).toHaveLength(1);
        expect(pendentes).toHaveLength(1);
        expect(lidos[0]!.destinatarioId).toBe(userMorador.id);
        expect(pendentes[0]!.destinatarioId).toBe(userPendente.id);
      });
    });
  }
);
