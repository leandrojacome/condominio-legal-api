-- AlterTable: add prazoCancelamentoHoras to AreaComum for cancellation deadline rule
-- Spec: reservas-areas-comuns/spec.md — cancelamento dentro/fora do prazo
ALTER TABLE "AreaComum" ADD COLUMN "prazoCancelamentoHoras" INTEGER NOT NULL DEFAULT 24;
