# Condominio Legal — Backend API

Backend REST/JSON do **Condominio Legal**, SaaS de gestão condominial multi-tenant. Construído com **Next.js 15** (App Router / Route Handlers) como framework HTTP e **Prisma** como ORM sobre PostgreSQL.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Módulos e Funcionalidades](#3-módulos-e-funcionalidades)
4. [Endpoints da API](#4-endpoints-da-api)
5. [Modelo de Dados](#5-modelo-de-dados)
6. [Setup Local](#6-setup-local)
7. [Testes](#7-testes)
8. [OpenSpec](#8-openspec)
9. [Estrutura de Pastas](#9-estrutura-de-pastas)
10. [Stack Tecnológica e Convenções](#10-stack-tecnológica-e-convenções)

---

## 1. Visão Geral

O **Condominio Legal** é um SaaS de gestão condominial. Uma única instância gerencia múltiplos condomínios com isolamento completo de dados entre tenants (shared database + `condominioId` + Row-Level Security do PostgreSQL).

Este repositório contém apenas o **backend** — a API REST/JSON que o frontend Next.js (`condominio-legal-web`) consome. Toda a lógica de negócio reside aqui: autenticação, autorização por perfil (RBAC), cobranças, comunicados, reservas, assembleias, ocorrências e portaria.

**Perfis de acesso do sistema:**

| Perfil | Descrição |
|--------|-----------|
| `sindico` | Administra o condomínio, todas as permissões |
| `administradora` | Empresa gestora terceirizada |
| `proprietario` | Dono da unidade |
| `inquilino` | Locatário da unidade |
| `porteiro` | Controla acesso de visitantes e encomendas |
| `conselho` | Membros do conselho condominial |

---

## 2. Arquitetura

A API segue uma **arquitetura em camadas**, com dependência unidirecional estrita:

```
HTTP (Route Handlers) → Application (Use Cases) → Domain → Infrastructure
```

### Camadas

| Camada | Diretório | Responsabilidade |
|--------|-----------|-----------------|
| **HTTP** | `src/app/api/` | Route Handlers do Next.js; recebe requests, valida (Zod), chama use cases, serializa responses |
| **Application** | `src/application/` | Casos de uso; orquestra entidades do domínio e adaptadores de infra |
| **Domain** | `src/domain/` | Entidades, regras de negócio puras, schemas Zod; sem I/O |
| **Infrastructure** | `src/infrastructure/` | Adaptadores de I/O — banco de dados (Prisma), PSP, notificações, fila, storage |
| **Lib** | `src/lib/` | Middleware e helpers transversais — auth, RBAC, tenant, erros, paginação |

**Regra de dependência:** o domínio nunca importa infraestrutura. A infraestrutura não importa diretamente a camada de aplicação (injeção via interfaces).

### Multi-tenant

Todos os registros tenant-scoped carregam `condominioId`. O contexto do tenant é extraído do JWT (`condominioId` no claim) e aplicado automaticamente via middleware Prisma. O PostgreSQL RLS atua como guardrail secundário.

### Tratamento de Erros

Toda resposta de erro segue o formato:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "campo 'valor' é obrigatório",
  "details": { ... }
}
```

| Status | Quando |
|--------|--------|
| 400 | Validação Zod falhou |
| 401 | Não autenticado |
| 403 | Autenticado, sem permissão (RBAC ou cross-tenant) |
| 404 | Recurso não encontrado |
| 409 | Conflito (duplicidade, reserva indisponível, voto duplicado) |
| 422 | Regra de negócio violada |
| 500 | Erro interno (stack trace nunca exposto em produção) |

### Paginação

Cursor-based por padrão (estável para conjuntos mutáveis):

```
GET /api/v1/cadastro/condominios/:id/comunicados?cursor=<opaque>&limit=20
```

Resposta:
```json
{
  "data": [...],
  "nextCursor": "eyJpZCI6Ii4uLiJ9",
  "total": null
}
```

---

## 3. Módulos e Funcionalidades

### 3.1 Cadastro

Gerenciamento do cadastro base do condomínio: condomínios, unidades, pessoas físicas e vínculos de acesso.

- Criar e gerenciar múltiplos **condomínios** (multi-tenant).
- Cadastrar **unidades** (apartamento, casa, comercial, garagem, depósito) com fração ideal.
- Cadastrar **pessoas** físicas com CPF único por condomínio.
- Criar **vínculos** pessoa↔unidade com papel (`proprietario`, `inquilino`, `morador`, `responsavel_financeiro`, `imobiliaria`) e perfil de sistema (RBAC).
- Controle de inadimplência por vínculo.

### 3.2 Financeiro

Gestão financeira completa do condomínio com emissão de boleto e Pix.

- Criar **cobranças** individuais ou em lote (taxa mensal, fundo de reserva, extra rateio, multa/juros, consumo).
- **Rateio automático** de despesas entre unidades por fração ideal ou igualmente.
- Emitir **boleto bancário registrado** e **QR Code Pix** via Efí Bank (Gerencianet).
- **Conciliação automática** via webhook do PSP — idempotente por `externalTransactionId`.
- Listar **inadimplentes** (cobranças vencidas) com processamento automático via BullMQ.

### 3.3 Comunicação

Sistema de avisos e comunicados com entrega multicanal.

- Publicar **comunicados** de 4 tipos: aviso geral, aviso segmentado, aviso individual e convocação.
- Entrega por 4 **canais**: `in_app`, `email` (Resend), `push` (Firebase FCM), `sms_whatsapp` (Twilio).
- Falha em um canal não bloqueia os demais (processamento via `Promise.allSettled`).
- Registrar **confirmação de leitura** (ciência) por destinatário.
- Consultar **status de entrega** por canal e destinatário.
- Perfis autorizados a publicar: `sindico`, `administradora`, `porteiro`, `conselho`.

### 3.4 Reservas de Áreas Comuns

Agendamento e controle de reservas de espaços do condomínio.

- Configurar **áreas comuns** com granularidade (`dia_inteiro`, `turno`, `horario`), política de conflito (`exclusiva`, `capacidade`), modo de aprovação, antecedência mínima/máxima e limite por unidade.
- Criar **reservas** com verificação de conflito (lock pessimista `SELECT FOR UPDATE`).
- Aprovação manual ou automática.
- Inadimplentes bloqueados para novas reservas.
- Taxa de uso integrada ao módulo **Financeiro** na confirmação.

### 3.5 Assembleias e Votações

Gestão de assembleias condominiais com suporte a voto presencial, online e híbrido.

- **Convocar assembleias** e gerenciar itens de pauta com critério de voto (`por_unidade` ou `por_fracao`), quórum mínimo e opção de voto secreto.
- Registrar **procurações** (voto por representação).
- **Votação** com validação de inadimplência e unicidade por unidade.
- **Apuração** automática com respeito ao quórum.
- **Auditoria** append-only gravada em transação junto ao voto.
- Geração de **ata** e notificação do resultado aos condôminos.

### 3.6 Ocorrências e Manutenção

Sistema de chamados com fluxo de status configurável por condomínio.

- Abrir **ocorrências** de tipos: manutenção, reclamação, sugestão, segurança, achados e perdidos.
- **Fluxo de status configurável** por condomínio (estados e transições válidas definidos em `FluxoStatus`/`FluxoTransicao`).
- Atribuir **responsável**, adicionar comentários e **histórico de status** append-only.
- **SLA** configurável — job BullMQ marca `sla_estourado` automaticamente no prazo.
- **Anexos** (fotos/documentos) via URLs pré-assinadas do S3/R2.
- **Avaliação** ao encerramento (classificação 1–5).
- Notificação do autor a cada mudança de status.

### 3.7 Portaria e Acessos

Controle de entrada e saída de visitantes, prestadores e encomendas.

- Registrar **acessos** por tipo: visitante, prestador, entrega, veículo.
- **Pré-autorização** pelo morador antes da chegada.
- **Confirmação em tempo real** via notificação push ao morador (timeout configurável).
- Registrar **saída** e histórico auditável com índice em `condominioId + criadoEm`.
- Gerenciar **encomendas** com foto/etiqueta (S3/R2) e notificação ao destinatário.
- Registrar **retirada** de encomenda.

### 3.8 Autenticação

- Login e sessão via **Auth.js v5** (NextAuth) com adaptador Prisma.
- JWT com claims `condominioId`, `perfil` e `vinculoId`.
- Middleware RBAC (`requirePerfil`) aplicado por rota.
- Rota `GET /api/v1/auth/me` retorna os dados do usuário autenticado.

---

## 4. Endpoints da API

Todas as rotas são prefixadas com `/api/v1/`. Autenticação via cookie de sessão Auth.js (obrigatória em todas as rotas exceto `/health` e `/api/auth/*`).

### Cadastro

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/cadastro/condominios` | Listar condomínios do usuário | ✓ |
| `POST` | `/api/v1/cadastro/condominios` | Criar condomínio | sindico / administradora |
| `GET` | `/api/v1/cadastro/condominios/:id` | Obter condomínio | ✓ |
| `PATCH` | `/api/v1/cadastro/condominios/:id` | Atualizar condomínio | sindico / administradora |
| `GET` | `/api/v1/cadastro/condominios/:id/unidades` | Listar unidades | ✓ |
| `POST` | `/api/v1/cadastro/condominios/:id/unidades` | Criar unidade | sindico / administradora |
| `GET` | `/api/v1/cadastro/condominios/:id/unidades/:unidadeId` | Obter unidade | ✓ |
| `PATCH` | `/api/v1/cadastro/condominios/:id/unidades/:unidadeId` | Atualizar unidade | sindico / administradora |
| `GET` | `/api/v1/cadastro/condominios/:id/pessoas` | Listar pessoas | sindico / administradora |
| `POST` | `/api/v1/cadastro/condominios/:id/pessoas` | Criar pessoa | sindico / administradora |
| `GET` | `/api/v1/cadastro/condominios/:id/pessoas/:pessoaId` | Obter pessoa | sindico / administradora |
| `PATCH` | `/api/v1/cadastro/condominios/:id/pessoas/:pessoaId` | Atualizar pessoa | sindico / administradora |
| `POST` | `/api/v1/cadastro/condominios/:id/vinculos` | Criar vínculo | sindico / administradora |
| `DELETE` | `/api/v1/cadastro/vinculos/:vinculoId` | Remover vínculo | sindico / administradora |

### Financeiro

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/financeiro/condominios/:id/cobrancas` | Listar cobranças | sindico / administradora |
| `POST` | `/api/v1/financeiro/condominios/:id/cobrancas` | Criar cobrança | sindico / administradora |
| `GET` | `/api/v1/financeiro/condominios/:id/cobrancas/:cobrancaId` | Obter cobrança | ✓ |
| `POST` | `/api/v1/financeiro/condominios/:id/cobrancas/:cobrancaId/emitir-boleto` | Emitir boleto | sindico / administradora |
| `POST` | `/api/v1/financeiro/condominios/:id/cobrancas/:cobrancaId/emitir-pix` | Emitir Pix | sindico / administradora |
| `POST` | `/api/v1/financeiro/condominios/:id/rateio` | Ratear despesa | sindico / administradora |
| `GET` | `/api/v1/financeiro/condominios/:id/inadimplentes` | Listar inadimplentes | sindico / administradora |
| `POST` | `/api/webhooks/psp` | Webhook PSP (Efí Bank) | HMAC |

### Comunicação

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/comunicacao/condominios/:id/comunicados` | Listar comunicados | ✓ |
| `POST` | `/api/v1/comunicacao/condominios/:id/comunicados` | Publicar comunicado | sindico / administradora / porteiro / conselho |
| `GET` | `/api/v1/comunicacao/condominios/:id/comunicados/:comunicadoId` | Obter comunicado | ✓ |
| `POST` | `/api/v1/comunicacao/condominios/:id/comunicados/:comunicadoId/ciencia` | Confirmar leitura | ✓ |
| `GET` | `/api/v1/comunicacao/condominios/:id/comunicados/:comunicadoId/entregas` | Status de entrega | sindico / administradora |

### Reservas

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/reservas/condominios/:id/areas-comuns` | Listar áreas comuns | ✓ |
| `POST` | `/api/v1/reservas/condominios/:id/areas-comuns` | Criar área comum | sindico / administradora |
| `GET` | `/api/v1/reservas/condominios/:id/areas-comuns/:areaId` | Obter área comum | ✓ |
| `PATCH` | `/api/v1/reservas/condominios/:id/areas-comuns/:areaId` | Atualizar área comum | sindico / administradora |
| `GET` | `/api/v1/reservas/condominios/:id/reservas` | Listar reservas | ✓ |
| `POST` | `/api/v1/reservas/condominios/:id/reservas` | Criar reserva | proprietario / inquilino / morador |
| `GET` | `/api/v1/reservas/condominios/:id/reservas/:reservaId` | Obter reserva | ✓ |
| `POST` | `/api/v1/reservas/condominios/:id/reservas/:reservaId/aprovar` | Aprovar reserva | sindico / administradora |
| `POST` | `/api/v1/reservas/condominios/:id/reservas/:reservaId/rejeitar` | Rejeitar reserva | sindico / administradora |
| `POST` | `/api/v1/reservas/condominios/:id/reservas/:reservaId/cancelar` | Cancelar reserva | proprietario / inquilino / sindico |

### Assembleias

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/assembleias/condominios/:id/assembleias` | Listar assembleias | ✓ |
| `POST` | `/api/v1/assembleias/condominios/:id/assembleias` | Convocar assembleia | sindico / administradora |
| `GET` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId` | Obter assembleia | ✓ |
| `POST` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/itens` | Adicionar item de pauta | sindico / administradora |
| `POST` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/procuracoes` | Registrar procuração | ✓ |
| `POST` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/votar` | Registrar voto | proprietario / inquilino / conselho |
| `POST` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/apurar` | Apurar resultado | sindico / administradora |
| `GET` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/auditoria` | Auditoria de votos | sindico / administradora |
| `GET` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/ata` | Obter/Gerar ata | ✓ |
| `POST` | `/api/v1/assembleias/condominios/:id/assembleias/:assembleiaId/notificar` | Notificar resultado | sindico / administradora |

### Ocorrências

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/ocorrencias/condominios/:id/ocorrencias` | Listar ocorrências | ✓ |
| `POST` | `/api/v1/ocorrencias/condominios/:id/ocorrencias` | Abrir ocorrência | ✓ |
| `GET` | `/api/v1/ocorrencias/condominios/:id/ocorrencias/:ocorrenciaId` | Obter ocorrência | ✓ |
| `POST` | `/api/v1/ocorrencias/condominios/:id/ocorrencias/:ocorrenciaId/status` | Atualizar status | sindico / administradora / porteiro |
| `POST` | `/api/v1/ocorrencias/condominios/:id/ocorrencias/:ocorrenciaId/atribuir` | Atribuir responsável | sindico / administradora |
| `POST` | `/api/v1/ocorrencias/condominios/:id/ocorrencias/:ocorrenciaId/comentarios` | Adicionar comentário | ✓ |
| `GET` | `/api/v1/ocorrencias/condominios/:id/ocorrencias/:ocorrenciaId/historico` | Histórico de status | ✓ |
| `POST` | `/api/v1/ocorrencias/condominios/:id/ocorrencias/:ocorrenciaId/anexos` | Gerar URL de upload | ✓ |
| `POST` | `/api/v1/ocorrencias/condominios/:id/ocorrencias/:ocorrenciaId/avaliar` | Avaliar ocorrência | proprietario / inquilino |
| `GET` | `/api/v1/ocorrencias/condominios/:id/fluxo` | Obter fluxo de status | ✓ |
| `POST` | `/api/v1/ocorrencias/condominios/:id/fluxo` | Configurar fluxo | sindico / administradora |

### Portaria

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/portaria/condominios/:id/acessos` | Listar acessos | porteiro / sindico / administradora |
| `POST` | `/api/v1/portaria/condominios/:id/acessos` | Registrar acesso | porteiro |
| `POST` | `/api/v1/portaria/condominios/:id/acessos/:acessoId/confirmar` | Confirmar acesso (morador) | proprietario / inquilino / morador |
| `POST` | `/api/v1/portaria/condominios/:id/acessos/:acessoId/saida` | Registrar saída | porteiro |
| `GET` | `/api/v1/portaria/condominios/:id/pre-autorizacoes` | Listar pré-autorizações | ✓ |
| `POST` | `/api/v1/portaria/condominios/:id/pre-autorizacoes` | Criar pré-autorização | proprietario / inquilino / morador |
| `GET` | `/api/v1/portaria/condominios/:id/encomendas` | Listar encomendas | porteiro / proprietario |
| `POST` | `/api/v1/portaria/condominios/:id/encomendas` | Registrar encomenda | porteiro |
| `POST` | `/api/v1/portaria/condominios/:id/encomendas/:encId/retirada` | Confirmar retirada | porteiro |

### Utilitários

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/api/v1/health` | Health check | Não |
| `GET` | `/api/v1/auth/me` | Dados do usuário autenticado | ✓ |
| `GET` | `/api/openapi.json` | Especificação OpenAPI 3.0 | Não |
| `GET` | `/api-docs` | Swagger UI interativo | Não |

---

## 5. Modelo de Dados

Schema completo em `prisma/schema.prisma`. Banco de dados: **PostgreSQL 16+**.

### Principais Entidades

```
Condominio
├── Unidade (bloco, numero, tipo, fracaoIdeal)
├── Pessoa (nome, cpf — único por condomínio, email, telefone)
├── Vinculo (Pessoa ↔ Unidade ↔ User, papel, perfil, inadimplente)
│
├── Cobranca (tipo, valor, competencia, vencimento, status)
│   ├── CobrancaEmissao (boleto ou pix, externalId)
│   ├── Pagamento (metodo, dataPagamento, externalTxId — único)
│   └── ConciliacaoLog (append-only, externalTransactionId — único)
│
├── Comunicado (titulo, conteudo, tipo)
│   └── EntregaComunicado (canal, status, dataCiencia)
│
├── AreaComum (granularidade, politicaConflito, modoAprovacao, taxaUso)
│   └── Reserva (inicio, fim, status, cobrancaId?)
│
├── Assembleia (titulo, dataHora, modalidade, status)
│   ├── ItemPauta (criterioVoto, quorumMinimo, votoSecreto)
│   │   ├── Voto (unidadeVotanteId — único por item)
│   │   └── VotoAuditoria (append-only)
│   ├── Procuracao (unidadeRepresentadaId, procuradorId)
│   └── Ata
│
├── FluxoStatus (nome, inicial, terminal, ordem)
│   └── FluxoTransicao (statusOrigem → statusDestino)
│
├── Ocorrencia (tipo, titulo, status, slaHoras, slaEstourado)
│   ├── AnexoOcorrencia (urlArquivo — S3/R2)
│   ├── OcorrenciaHistorico (append-only)
│   └── AvaliacaoOcorrencia (classificacao 1–5)
│
├── RegistroAcesso (tipo, nomeVisitante, status)
├── PreAutorizacao (nomeVisitante, validoAte)
└── Encomenda (remetente, fotoKey — S3/R2, retiradaEm)
```

### Entidades de Autenticação (Auth.js)

```
User (email, passwordHash, fcmToken)
├── Account (OAuth providers)
├── Session
└── VerificationToken
```

### Enums Principais

| Enum | Valores |
|------|---------|
| `TipoUnidade` | `APARTAMENTO`, `CASA`, `COMERCIAL`, `GARAGEM`, `DEPOSITO` |
| `PerfilUsuario` | `sindico`, `administradora`, `proprietario`, `inquilino`, `porteiro`, `conselho` |
| `PapelVinculo` | `proprietario`, `inquilino`, `morador`, `responsavel_financeiro`, `imobiliaria` |
| `TipoCobranca` | `taxa_mensal`, `fundo_reserva`, `extra_rateio`, `multa_juros`, `consumo` |
| `StatusCobranca` | `em_aberto`, `em_atraso`, `paga`, `cancelada` |
| `TipoComunicado` | `aviso_geral`, `aviso_segmentado`, `aviso_individual`, `convocacao` |
| `CanalNotificacao` | `in_app`, `email`, `push`, `sms_whatsapp` |
| `StatusReserva` | `pendente`, `confirmada`, `cancelada`, `rejeitada` |
| `StatusAssembleia` | `convocada`, `em_votacao`, `votacao_encerrada`, `apurada` |
| `TipoOcorrencia` | `manutencao`, `reclamacao`, `sugestao`, `seguranca`, `achados_perdidos` |
| `TipoAcesso` | `visitante`, `prestador`, `entrega`, `veiculo` |
| `StatusAcesso` | `aguardando_confirmacao`, `autorizado`, `negado`, `no_condominio`, `encerrado` |

---

## 6. Setup Local

### Pré-requisitos

- **Node.js 22 LTS**
- **PostgreSQL 16+** (local ou via Docker)
- **Redis** (para filas BullMQ — local ou Upstash)
- Conta **Efí Bank** (sandbox para testes de pagamento — opcional)

### Instalação

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd condominio-legal-api

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais (ver seção abaixo)

# 4. Gerar o client Prisma
npm run db:generate

# 5. Aplicar as migrations no banco
npm run db:migrate

# 6. Iniciar em modo de desenvolvimento
npm run dev
```

A API estará disponível em `http://localhost:3000`.

### Variáveis de Ambiente

Copie `.env.example` e preencha as variáveis:

```bash
# ─── Banco de dados ─────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/condominio_legal
DIRECT_URL=postgresql://user:password@localhost:5432/condominio_legal
# DIRECT_URL é necessário para o `prisma migrate` (sem pooler)

# ─── Auth.js v5 ─────────────────────────────────────────────────────────────
AUTH_SECRET=<gere com: openssl rand -base64 32>
AUTH_URL=http://localhost:3000

# ─── PSP — Efí Bank (Gerencianet) ───────────────────────────────────────────
EFI_CLIENT_ID=<client_id do painel Efí>
EFI_CLIENT_SECRET=<client_secret do painel Efí>
EFI_PIX_CERT_PATH=./certs/efi-cert.p12   # Certificado mTLS obrigatório para Pix
EFI_PIX_CERT_PASSPHRASE=<passphrase do certificado>
EFI_SANDBOX=true                          # false em produção

# ─── Notificações ────────────────────────────────────────────────────────────
RESEND_API_KEY=<chave da API Resend para e-mail>
FIREBASE_SERVICE_ACCOUNT_JSON=<JSON do service account Firebase (em linha)>
TWILIO_ACCOUNT_SID=<SID Twilio para SMS>
TWILIO_AUTH_TOKEN=<token Twilio>
TWILIO_WHATSAPP_FROM=whatsapp:+55...

# ─── Storage ─────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=<access key AWS ou Cloudflare R2>
AWS_SECRET_ACCESS_KEY=<secret key>
AWS_REGION=us-east-1
S3_BUCKET=<nome do bucket>

# ─── Redis / Filas ───────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
```

> **Segurança:** nunca comite o `.env` no repositório. Use um serviço de secrets (AWS Secrets Manager, Vercel Env, etc.) em produção.

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento com Turbopack |
| `npm run build` | Compila para produção |
| `npm run start` | Inicia o servidor compilado |
| `npm run lint` | Executa ESLint |
| `npm run typecheck` | Verifica tipos TypeScript (sem emitir) |
| `npm run db:generate` | Gera o Prisma Client a partir do schema |
| `npm run db:push` | Aplica o schema no banco sem migrations |
| `npm run db:migrate` | Cria e aplica uma nova migration |
| `npm run db:studio` | Abre o Prisma Studio no navegador |
| `npm run test` | Executa a suíte de testes (Vitest) |
| `npm run test:watch` | Executa os testes em modo watch |
| `npm run test:coverage` | Executa testes com relatório de cobertura |

---

## 7. Testes

O projeto usa **Vitest** com suporte a testes unitários e de integração.

```bash
# Rodar todos os testes
npm run test

# Modo watch (desenvolvimento)
npm run test:watch

# Com cobertura (relatório HTML em coverage/)
npm run test:coverage
```

### Estratégia de testes

| Camada | Ferramenta | Onde |
|--------|-----------|------|
| Unitários (domínio/use-cases) | Vitest | `src/domain/**/__tests__/` |
| Integração (route handlers + PostgreSQL real) | Vitest + **Testcontainers** | `src/__tests__/` e `src/domain/**/__tests__/*.integration.test.ts` |
| Contratos de API | Schemas **Zod** como source of truth | `src/domain/**/schemas.ts` |
| Mocks de serviços externos (PSP, FCM) | **MSW** (Mock Service Worker) | configurado nos testes |

Os testes de integração sobem um container PostgreSQL efêmero via Testcontainers, portanto **não precisam de um banco local em execução**. O timeout padrão dos testes é 60 segundos para acomodar o tempo de inicialização do container.

### Configuração (vitest.config.ts)

```ts
// Alias @/ aponta para src/
// globals: true — sem import describe/it nos testes
// environment: node
// testTimeout / hookTimeout: 60s para Testcontainers
```

---

## 8. OpenSpec

O projeto utiliza **OpenSpec** para gerenciar requisitos técnicos e especificações de funcionalidades. As specs ficam em:

```
openspec/
└── changes/
    └── condominio-backend-scope/
        ├── proposal.md           # proposta da mudança
        ├── .openspec.yaml        # metadata da mudança
        └── specs/
            ├── cadastro/spec.md
            ├── financeiro/spec.md
            ├── comunicacao/spec.md
            ├── reservas-areas-comuns/spec.md
            ├── assembleias-votacoes/spec.md
            ├── ocorrencias-manutencao/spec.md
            └── portaria-acessos/spec.md
```

Cada `spec.md` descreve requisitos funcionais, regras de negócio, casos de erro e critérios de aceite de um módulo. O ARD (`docs/ARD.md`) documenta as decisões técnicas tomadas com base nessas specs e é a referência autoritativa de arquitetura.

A spec OpenAPI gerada (endpoint `GET /api/openapi.json`) e o Swagger UI (`GET /api-docs`) refletem o contrato HTTP atual da API.

---

## 9. Estrutura de Pastas

```
condominio-legal-api/
├── docs/
│   └── ARD.md                         # Decisões de arquitetura (autoritativo)
├── openspec/                          # Especificações funcionais por módulo
├── prisma/
│   ├── schema.prisma                  # Schema do banco de dados
│   └── migrations/                    # Histórico de migrations SQL
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── (v1)/                  # Rotas legadas em migração
│   │   │   ├── v1/                    # Rotas da API v1
│   │   │   │   ├── auth/me/           # Dados do usuário autenticado
│   │   │   │   ├── cadastro/          # Módulo Cadastro
│   │   │   │   ├── financeiro/        # Módulo Financeiro
│   │   │   │   ├── comunicacao/       # Módulo Comunicação
│   │   │   │   ├── reservas/          # Módulo Reservas
│   │   │   │   ├── assembleias/       # Módulo Assembleias
│   │   │   │   ├── ocorrencias/       # Módulo Ocorrências
│   │   │   │   ├── portaria/          # Módulo Portaria
│   │   │   │   └── health/            # Health check
│   │   │   ├── auth/[...nextauth]/    # Auth.js route handler
│   │   │   ├── openapi.json/          # Spec OpenAPI gerada
│   │   │   └── webhooks/psp/          # Webhook Efí Bank
│   │   ├── api-docs/                  # Swagger UI (page.tsx)
│   │   └── layout.tsx
│   ├── application/                   # Casos de uso por módulo
│   │   ├── assembleias/use-cases/
│   │   ├── cadastro/use-cases/
│   │   ├── comunicacao/use-cases/
│   │   ├── financeiro/use-cases/
│   │   ├── ocorrencias/use-cases/
│   │   ├── portaria/use-cases/
│   │   └── reservas/use-cases/
│   ├── domain/                        # Entidades e schemas Zod por módulo
│   │   ├── assembleias/
│   │   ├── cadastro/
│   │   ├── comunicacao/
│   │   ├── financeiro/
│   │   ├── ocorrencias/
│   │   ├── portaria/
│   │   └── reservas/
│   ├── infrastructure/                # Adaptadores de I/O
│   │   ├── db/client.ts               # Prisma client singleton
│   │   ├── notifications/
│   │   │   ├── email.ts               # Resend
│   │   │   └── fcm.ts                 # Firebase Cloud Messaging
│   │   ├── payments/
│   │   │   ├── provider.ts            # Interface PaymentProvider
│   │   │   ├── efi.ts                 # Adaptador Efí Bank (Gerencianet)
│   │   │   └── mock.ts                # Mock para testes
│   │   ├── queue/
│   │   │   ├── inadimplencia-job.ts   # Job diário de inadimplência
│   │   │   ├── sla-job.ts             # Job de SLA de ocorrências
│   │   │   └── workers/
│   │   │       └── notification.worker.ts
│   │   └── storage/
│   │       └── s3.ts                  # AWS S3 / Cloudflare R2
│   ├── lib/                           # Helpers transversais
│   │   ├── auth/
│   │   │   ├── index.ts               # Auth.js config
│   │   │   ├── password.ts            # Hash de senha
│   │   │   └── rbac.ts                # requirePerfil middleware
│   │   ├── errors/index.ts            # Formato padrão de erros
│   │   ├── tenant/
│   │   │   ├── index.ts               # Prisma middleware de tenant
│   │   │   └── constants.ts           # Modelos tenant-scoped
│   │   ├── supabase/server.ts         # Client Supabase (server-side)
│   │   ├── openapi-spec.ts            # Gerador da spec OpenAPI
│   │   ├── pagination.ts              # Helpers de paginação cursor-based
│   │   └── utils.ts
│   └── __tests__/                     # Testes de integração globais
├── .env.example                       # Template de variáveis de ambiente
├── next.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## 10. Stack Tecnológica e Convenções

### Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Runtime | Node.js | 22 LTS |
| Linguagem | TypeScript | 5.x (`strict: true`) |
| Framework HTTP | Next.js (App Router) | 15+ |
| ORM | Prisma | ^6 |
| Banco de dados | PostgreSQL | 16+ |
| Autenticação | Auth.js v5 (NextAuth) | 5.0.0-beta |
| Auth/DB client | Supabase JS | ^2 |
| Validação | Zod | ^3 |
| PSP | Efí Bank (Gerencianet) | — |
| E-mail | Resend | ^4 |
| Push | Firebase Admin SDK (FCM) | ^13 |
| SMS/WhatsApp | Twilio | ^5 |
| Storage | AWS S3 / Cloudflare R2 | @aws-sdk v3 |
| Fila / Jobs | BullMQ + Redis | ^5 |
| Log | Pino | ^9 |
| Testes | Vitest + Testcontainers + MSW | ^3 |

### Convenções

- **TypeScript strict:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Alias de importação:** `@/` aponta para `src/` em todo o projeto.
- **Schemas Zod:** definem e documentam o contrato de entrada de cada endpoint; são os contratos de API reusados nos testes.
- **Paginação cursor-based:** padrão para todas as listagens mutáveis; offset apenas para relatórios estáticos.
- **Idempotência:** webhooks e emissões de cobrança protegidos por constraints `UNIQUE` no banco.
- **Erros cross-tenant retornam 403**, nunca 404 — para não vazar existência de recursos de outros tenants.
- **Logs estruturados com Pino** — JSON em produção, pretty em desenvolvimento.
- **Segredos nunca no código:** `.env` local, serviço de secrets em produção.
- **Convenção de commits:** mensagens imperativas em inglês; CI bloqueia commits sem lint limpo.
