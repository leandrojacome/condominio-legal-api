-- AlterTable: add responsavelId (userId do responsável financeiro/devedor) to Cobranca
ALTER TABLE "Cobranca" ADD COLUMN "responsavelId" TEXT;
