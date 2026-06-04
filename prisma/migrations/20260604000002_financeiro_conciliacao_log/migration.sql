-- CreateTable: ConciliacaoLog — append-only audit log per ARD §3.9
-- UNIQUE on externalTransactionId enforces idempotency per ARD §4.4

CREATE TABLE "ConciliacaoLog" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "externalTransactionId" TEXT NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL,
    "dataEvento" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciliacaoLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConciliacaoLog_externalTransactionId_key" ON "ConciliacaoLog"("externalTransactionId");

-- CreateIndex
CREATE INDEX "ConciliacaoLog_cobrancaId_idx" ON "ConciliacaoLog"("cobrancaId");

-- AddForeignKey
ALTER TABLE "ConciliacaoLog" ADD CONSTRAINT "ConciliacaoLog_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
