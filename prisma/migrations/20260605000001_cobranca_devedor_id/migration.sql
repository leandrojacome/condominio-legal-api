-- Migration: add devedorId to Cobranca (M10 — CODAA-157)
-- Adds an explicit FK from Cobranca to Vinculo so the responsible debtor
-- is identified directly rather than inferred from responsavelId (userId).
-- Field is nullable: existing rows are unaffected; SetNull on Vinculo delete.

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN "devedorId" TEXT;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_devedorId_fkey"
  FOREIGN KEY ("devedorId") REFERENCES "Vinculo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (composite with condominioId for multi-tenant efficiency per Code Review nit)
CREATE INDEX "Cobranca_condominioId_devedorId_idx" ON "Cobranca"("condominioId", "devedorId");
