-- CODAA-270: persistent idempotency response store for tenant-scoped
-- sensitive routes from CODAA-245/CODAA-263.
--
-- Server-only table: RLS is enabled and no anon/authenticated policies are
-- created. Backend code should access it through the Prisma/server database
-- connection or Supabase service role, never directly from mobile clients.

CREATE TYPE "IdempotencyRecordStatus" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "operationScope" VARCHAR(160) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(128) NOT NULL,
    "responseStatus" "IdempotencyRecordStatus" NOT NULL DEFAULT 'pending',
    "statusCode" INTEGER,
    "responseHeaders" JSONB,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdempotencyRecord_condominioId_fkey"
      FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IdempotencyRecord_completed_response_check"
      CHECK (
        ("responseStatus" <> 'completed')
        OR ("statusCode" IS NOT NULL AND "responseBody" IS NOT NULL)
      ),
    CONSTRAINT "IdempotencyRecord_status_code_check"
      CHECK ("statusCode" IS NULL OR ("statusCode" >= 100 AND "statusCode" <= 599))
);

CREATE UNIQUE INDEX "IdempotencyRecord_condominioId_operationScope_idempotencyKey_key"
  ON "IdempotencyRecord"("condominioId", "operationScope", "idempotencyKey");

CREATE INDEX "IdempotencyRecord_condominioId_expiresAt_idx"
  ON "IdempotencyRecord"("condominioId", "expiresAt");

CREATE INDEX "IdempotencyRecord_condominioId_operationScope_requestHash_idx"
  ON "IdempotencyRecord"("condominioId", "operationScope", "requestHash");

CREATE INDEX "IdempotencyRecord_expiresAt_idx"
  ON "IdempotencyRecord"("expiresAt");

ALTER TABLE "IdempotencyRecord" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "IdempotencyRecord" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "IdempotencyRecord" FROM authenticated;
  END IF;
END $$;
