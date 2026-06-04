-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoUnidade" AS ENUM ('APARTAMENTO', 'CASA', 'COMERCIAL', 'GARAGEM', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "PapelVinculo" AS ENUM ('proprietario', 'inquilino', 'morador', 'responsavel_financeiro', 'imobiliaria');

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('sindico', 'administradora', 'proprietario', 'inquilino', 'porteiro', 'conselho');

-- CreateEnum
CREATE TYPE "TipoCobranca" AS ENUM ('taxa_mensal', 'fundo_reserva', 'extra_rateio', 'multa_juros', 'consumo');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('em_aberto', 'em_atraso', 'paga', 'cancelada');

-- CreateEnum
CREATE TYPE "CriterioRateio" AS ENUM ('fracao_ideal', 'igual');

-- CreateEnum
CREATE TYPE "MetodoEmissao" AS ENUM ('boleto', 'pix');

-- CreateEnum
CREATE TYPE "StatusEmissao" AS ENUM ('emitido', 'cancelado', 'erro');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('boleto', 'pix', 'manual');

-- CreateEnum
CREATE TYPE "TipoComunicado" AS ENUM ('aviso_geral', 'aviso_segmentado', 'aviso_individual', 'convocacao');

-- CreateEnum
CREATE TYPE "CanalNotificacao" AS ENUM ('in_app', 'email', 'push', 'sms_whatsapp');

-- CreateEnum
CREATE TYPE "StatusEntrega" AS ENUM ('pendente', 'enviado', 'falha');

-- CreateEnum
CREATE TYPE "Granularidade" AS ENUM ('dia_inteiro', 'turno', 'horario');

-- CreateEnum
CREATE TYPE "PoliticaConflito" AS ENUM ('exclusiva', 'capacidade');

-- CreateEnum
CREATE TYPE "ModoAprovacao" AS ENUM ('automatica', 'requer_aprovacao');

-- CreateEnum
CREATE TYPE "StatusReserva" AS ENUM ('pendente', 'confirmada', 'cancelada', 'rejeitada');

-- CreateEnum
CREATE TYPE "StatusAssembleia" AS ENUM ('convocada', 'em_votacao', 'votacao_encerrada', 'apurada');

-- CreateEnum
CREATE TYPE "CriterioVoto" AS ENUM ('por_unidade', 'por_fracao');

-- CreateEnum
CREATE TYPE "OpcaoVoto" AS ENUM ('sim', 'nao', 'abstencao');

-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('manutencao', 'reclamacao', 'sugestao', 'seguranca', 'achados_perdidos');

-- CreateEnum
CREATE TYPE "PrioridadeOcorrencia" AS ENUM ('baixa', 'media', 'alta');

-- CreateEnum
CREATE TYPE "TipoAcesso" AS ENUM ('visitante', 'prestador', 'entrega', 'veiculo');

-- CreateEnum
CREATE TYPE "StatusAcesso" AS ENUM ('aguardando_confirmacao', 'autorizado', 'negado', 'no_condominio', 'encerrado');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condominio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "multaAtraso" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "jurosMensal" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unidade" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "bloco" TEXT,
    "numero" TEXT NOT NULL,
    "tipo" "TipoUnidade" NOT NULL DEFAULT 'APARTAMENTO',
    "fracaoIdeal" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pessoa" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vinculo" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "papel" "PapelVinculo" NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "inadimplente" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "tipo" "TipoCobranca" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "competencia" TEXT NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'em_aberto',
    "descricao" TEXT,
    "criterioRateio" "CriterioRateio",
    "loteRateioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobrancaEmissao" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "metodo" "MetodoEmissao" NOT NULL,
    "status" "StatusEmissao" NOT NULL DEFAULT 'emitido',
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CobrancaEmissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "dataPagamento" TIMESTAMP(3) NOT NULL,
    "externalTxId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comunicado" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" "TipoComunicado" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaComunicado" (
    "id" TEXT NOT NULL,
    "comunicadoId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "canal" "CanalNotificacao" NOT NULL,
    "status" "StatusEntrega" NOT NULL DEFAULT 'pendente',
    "dataCiencia" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaComunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaComum" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "granularidade" "Granularidade" NOT NULL,
    "politicaConflito" "PoliticaConflito" NOT NULL DEFAULT 'exclusiva',
    "capacidade" INTEGER,
    "modoAprovacao" "ModoAprovacao" NOT NULL DEFAULT 'automatica',
    "antecedenciaMinimaHoras" INTEGER NOT NULL DEFAULT 24,
    "antecedenciaMaximaDias" INTEGER NOT NULL DEFAULT 30,
    "limiteReservasPorUnidade" INTEGER NOT NULL DEFAULT 1,
    "taxaUso" DOUBLE PRECISION,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaComum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "areaComumId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "status" "StatusReserva" NOT NULL DEFAULT 'pendente',
    "cobrancaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assembleia" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "modalidade" TEXT NOT NULL DEFAULT 'presencial',
    "status" "StatusAssembleia" NOT NULL DEFAULT 'convocada',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assembleia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPauta" (
    "id" TEXT NOT NULL,
    "assembleiaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "criterioVoto" "CriterioVoto" NOT NULL DEFAULT 'por_unidade',
    "quorumMinimo" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "votoSecreto" BOOLEAN NOT NULL DEFAULT false,
    "resultado" "OpcaoVoto",
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "ItemPauta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voto" (
    "id" TEXT NOT NULL,
    "itemPautaId" TEXT NOT NULL,
    "unidadeVotanteId" TEXT NOT NULL,
    "procuradorId" TEXT,
    "opcao" "OpcaoVoto" NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "votadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotoAuditoria" (
    "id" TEXT NOT NULL,
    "itemPautaId" TEXT NOT NULL,
    "unidadeVotanteId" TEXT NOT NULL,
    "opcao" "OpcaoVoto" NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "votadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procuracao" (
    "id" TEXT NOT NULL,
    "assembleiaId" TEXT NOT NULL,
    "unidadeRepresentadaId" TEXT NOT NULL,
    "procuradorId" TEXT NOT NULL,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Procuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ata" (
    "id" TEXT NOT NULL,
    "assembleiaId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "geradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "tipo" "TipoOcorrencia" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "autorId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "prioridade" "PrioridadeOcorrencia",
    "slaHoras" INTEGER,
    "slaEstourado" BOOLEAN NOT NULL DEFAULT false,
    "unidadeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradaEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnexoOcorrencia" (
    "id" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "urlArquivo" TEXT NOT NULL,
    "nomeArquivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnexoOcorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcorrenciaHistorico" (
    "id" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "statusAnterior" TEXT NOT NULL,
    "statusNovo" TEXT NOT NULL,
    "comentario" TEXT,
    "autorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcorrenciaHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoOcorrencia" (
    "id" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "classificacao" INTEGER NOT NULL,
    "comentario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoOcorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAcesso" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "tipo" "TipoAcesso" NOT NULL,
    "nomeVisitante" TEXT NOT NULL,
    "documento" TEXT,
    "unidadeDestinoId" TEXT NOT NULL,
    "porteiroPorId" TEXT,
    "entrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saida" TIMESTAMP(3),
    "status" "StatusAcesso" NOT NULL DEFAULT 'aguardando_confirmacao',
    "preAutorizacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreAutorizacao" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nomeVisitante" TEXT NOT NULL,
    "autorizadoPorId" TEXT NOT NULL,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "utilizada" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreAutorizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encomenda" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "unidadeDestinoId" TEXT NOT NULL,
    "remetente" TEXT,
    "fotoKey" TEXT,
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiradaEm" TIMESTAMP(3),
    "retiradorId" TEXT,
    "notificadoEm" TIMESTAMP(3),

    CONSTRAINT "Encomenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Condominio_cnpj_key" ON "Condominio"("cnpj");

-- CreateIndex
CREATE INDEX "Unidade_condominioId_idx" ON "Unidade"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "Unidade_condominioId_bloco_numero_key" ON "Unidade"("condominioId", "bloco", "numero");

-- CreateIndex
CREATE INDEX "Pessoa_condominioId_idx" ON "Pessoa"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "Pessoa_condominioId_cpf_key" ON "Pessoa"("condominioId", "cpf");

-- CreateIndex
CREATE INDEX "Vinculo_condominioId_idx" ON "Vinculo"("condominioId");

-- CreateIndex
CREATE INDEX "Vinculo_condominioId_userId_idx" ON "Vinculo"("condominioId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vinculo_condominioId_pessoaId_unidadeId_papel_key" ON "Vinculo"("condominioId", "pessoaId", "unidadeId", "papel");

-- CreateIndex
CREATE INDEX "Cobranca_condominioId_idx" ON "Cobranca"("condominioId");

-- CreateIndex
CREATE INDEX "Cobranca_condominioId_status_idx" ON "Cobranca"("condominioId", "status");

-- CreateIndex
CREATE INDEX "Cobranca_condominioId_unidadeId_idx" ON "Cobranca"("condominioId", "unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "CobrancaEmissao_externalId_key" ON "CobrancaEmissao"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_externalTxId_key" ON "Pagamento"("externalTxId");

-- CreateIndex
CREATE INDEX "Comunicado_condominioId_idx" ON "Comunicado"("condominioId");

-- CreateIndex
CREATE INDEX "Comunicado_condominioId_criadoEm_idx" ON "Comunicado"("condominioId", "criadoEm");

-- CreateIndex
CREATE INDEX "EntregaComunicado_comunicadoId_idx" ON "EntregaComunicado"("comunicadoId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaComunicado_comunicadoId_destinatarioId_canal_key" ON "EntregaComunicado"("comunicadoId", "destinatarioId", "canal");

-- CreateIndex
CREATE INDEX "AreaComum_condominioId_idx" ON "AreaComum"("condominioId");

-- CreateIndex
CREATE INDEX "Reserva_condominioId_idx" ON "Reserva"("condominioId");

-- CreateIndex
CREATE INDEX "Reserva_areaComumId_inicio_fim_idx" ON "Reserva"("areaComumId", "inicio", "fim");

-- CreateIndex
CREATE INDEX "Assembleia_condominioId_idx" ON "Assembleia"("condominioId");

-- CreateIndex
CREATE INDEX "ItemPauta_assembleiaId_idx" ON "ItemPauta"("assembleiaId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPauta_assembleiaId_titulo_key" ON "ItemPauta"("assembleiaId", "titulo");

-- CreateIndex
CREATE UNIQUE INDEX "Voto_itemPautaId_unidadeVotanteId_key" ON "Voto"("itemPautaId", "unidadeVotanteId");

-- CreateIndex
CREATE INDEX "VotoAuditoria_itemPautaId_idx" ON "VotoAuditoria"("itemPautaId");

-- CreateIndex
CREATE INDEX "Procuracao_assembleiaId_idx" ON "Procuracao"("assembleiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Ata_assembleiaId_key" ON "Ata"("assembleiaId");

-- CreateIndex
CREATE INDEX "Ocorrencia_condominioId_idx" ON "Ocorrencia"("condominioId");

-- CreateIndex
CREATE INDEX "Ocorrencia_condominioId_status_idx" ON "Ocorrencia"("condominioId", "status");

-- CreateIndex
CREATE INDEX "OcorrenciaHistorico_ocorrenciaId_idx" ON "OcorrenciaHistorico"("ocorrenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoOcorrencia_ocorrenciaId_key" ON "AvaliacaoOcorrencia"("ocorrenciaId");

-- CreateIndex
CREATE INDEX "RegistroAcesso_condominioId_criadoEm_idx" ON "RegistroAcesso"("condominioId", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroAcesso_condominioId_unidadeDestinoId_idx" ON "RegistroAcesso"("condominioId", "unidadeDestinoId");

-- CreateIndex
CREATE INDEX "PreAutorizacao_condominioId_unidadeId_idx" ON "PreAutorizacao"("condominioId", "unidadeId");

-- CreateIndex
CREATE INDEX "Encomenda_condominioId_idx" ON "Encomenda"("condominioId");

-- CreateIndex
CREATE INDEX "Encomenda_condominioId_unidadeDestinoId_idx" ON "Encomenda"("condominioId", "unidadeDestinoId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unidade" ADD CONSTRAINT "Unidade_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobrancaEmissao" ADD CONSTRAINT "CobrancaEmissao_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaComunicado" ADD CONSTRAINT "EntregaComunicado_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "Comunicado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaComum" ADD CONSTRAINT "AreaComum_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_areaComumId_fkey" FOREIGN KEY ("areaComumId") REFERENCES "AreaComum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assembleia" ADD CONSTRAINT "Assembleia_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPauta" ADD CONSTRAINT "ItemPauta_assembleiaId_fkey" FOREIGN KEY ("assembleiaId") REFERENCES "Assembleia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voto" ADD CONSTRAINT "Voto_itemPautaId_fkey" FOREIGN KEY ("itemPautaId") REFERENCES "ItemPauta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotoAuditoria" ADD CONSTRAINT "VotoAuditoria_itemPautaId_fkey" FOREIGN KEY ("itemPautaId") REFERENCES "ItemPauta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procuracao" ADD CONSTRAINT "Procuracao_assembleiaId_fkey" FOREIGN KEY ("assembleiaId") REFERENCES "Assembleia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ata" ADD CONSTRAINT "Ata_assembleiaId_fkey" FOREIGN KEY ("assembleiaId") REFERENCES "Assembleia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoOcorrencia" ADD CONSTRAINT "AnexoOcorrencia_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcorrenciaHistorico" ADD CONSTRAINT "OcorrenciaHistorico_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoOcorrencia" ADD CONSTRAINT "AvaliacaoOcorrencia_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

