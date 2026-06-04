# ARD — Condominio Legal Backend

> **Este documento é a referência de arquitetura autoritativa para o backend do Condominio Legal.**
> Toda decisão técnica de implementação do backend DEVE estar alinhada com este ARD ou gerar uma revisão explícita dele antes de desviar.
>
> **Versão:** 1.1.0 — 2026-06-04
> **Autor:** Dev Backend ([CODAA-24](/CODAA/issues/CODAA-24))
> **Aprovação pendente:** [@Chefe](/CODAA/agents/chefe)

---

## 1. Contexto

O **Condominio Legal** é um SaaS de gestão condominial multi-tenant. Uma única instância gerencia múltiplos condomínios com isolamento completo de dados entre tenants.

**Escopo desta fase:** backend apenas — API REST/JSON, domínio e camada de dados. Frontend é delegado separadamente.

**Specs que baseiam este ARD** (todas em `openspec/changes/condominio-backend-scope/specs/`):

| Módulo | Spec | Requisitos chave |
|--------|------|-----------------|
| `cadastro` | spec.md | Multi-tenant, unidades, pessoas, vínculos por papel |
| `financeiro` | spec.md | Cobranças, rateio, boleto + Pix, conciliação, inadimplência |
| `comunicacao` | spec.md | Avisos, 4 canais, entrega multicanal, confirmação de leitura |
| `reservas-areas-comuns` | spec.md | Config por área, conflito, inadimplente, taxa → Financeiro |
| `assembleias-votacoes` | spec.md | Híbrida, voto por unidade/fração, quórum, procuração, ata/auditoria |
| `ocorrencias-manutencao` | spec.md | Fluxo configurável, SLA, anexos, avaliação |
| `portaria-acessos` | *pendente* | Visitantes, prestadores, encomendas — placeholder; não bloqueia stack |

---

## 2. Stack Base

### 2.1 Runtime e linguagem

| Tecnologia | Versão alvo | Justificativa |
|-----------|-------------|---------------|
| **Node.js** | 22 LTS (Active) | LTS ativo; suporte nativo a ESM e `fetch`; alinhado com Next.js 15+ |
| **TypeScript** | 5.x, `strict: true` | Tipagem forte em todo o domínio; eliminação de bugs em tempo de compilação |
| **Next.js** | 15+ (App Router) | Framework unificado; Route Handlers como camada HTTP da API; server-side auth middleware nativo |

**Config TypeScript mínima:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

### 2.2 Arquitetura de camadas

```
src/
├── app/
│   └── api/                  # Route Handlers (HTTP — Next.js App Router)
│       ├── (v1)/             # Versão da API
│       │   ├── cadastro/
│       │   ├── financeiro/
│       │   ├── comunicacao/
│       │   ├── reservas/
│       │   ├── assembleias/
│       │   └── ocorrencias/
│       └── webhooks/         # Endpoints de webhook (PSP, FCM, etc.)
├── domain/                   # Entidades, regras de negócio puras (sem I/O)
│   ├── cadastro/
│   ├── financeiro/
│   ├── comunicacao/
│   ├── reservas/
│   ├── assembleias/
│   └── ocorrencias/
├── application/              # Casos de uso — orquestram domínio + infra
│   └── <modulo>/
│       └── use-cases/
├── infrastructure/           # Adaptadores de I/O (DB, APIs externas, filas)
│   ├── db/                   # Prisma client, migrations
│   ├── payments/             # Integração PSP
│   ├── notifications/        # Email, push, SMS/WhatsApp
│   ├── queue/                # BullMQ workers
│   └── storage/              # S3/R2 para anexos
└── lib/                      # Middleware, helpers transversais (auth, errors, tenant)
    ├── auth/
    ├── tenant/
    └── errors/
```

**Regra de dependência:** `HTTP → Application → Domain`. Domínio não importa infraestrutura. Infraestrutura não importa Application diretamente (injeção via interfaces).

---

## 3. Bibliotecas por Capability

### 3.1 ORM / Persistência e Migrations

**Banco de dados:** PostgreSQL 16+

| Decisão | Biblioteca | Alternativa considerada |
|---------|-----------|------------------------|
| ORM | **Prisma** `^6` | Drizzle ORM |
| Migrations | Prisma Migrate (integrado) | Flyway |

**Justificativa (Prisma):** Geração automática de tipos TypeScript a partir do schema; CLI de migrations madura; soft-delete e middleware de tenant integráveis; ecosistema amplo. Drizzle é mais leve mas exige mais boilerplate para multi-tenant.

**Motivação na spec:** `cadastro/spec.md` — isolamento multi-tenant obrigatório; todo registro associado a exatamente um condomínio.

### 3.2 Estratégia Multi-Tenant

**Abordagem:** Banco de dados compartilhado com coluna discriminadora `condominioId` em todas as tabelas tenant-scoped + Row-Level Security (RLS) do PostgreSQL como guardrail secundário.

```sql
-- Exemplo: toda tabela scoped tem condominioId
ALTER TABLE "Unidade" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Unidade"
  USING ("condominioId" = current_setting('app.current_condominio_id')::uuid);
```

**Aplicação no código:**

```typescript
// lib/tenant/prisma-middleware.ts
prisma.$use(async (params, next) => {
  const ctx = getTenantContext(); // extraído do JWT
  if (TENANT_SCOPED_MODELS.includes(params.model)) {
    params.args.where = { ...params.args.where, condominioId: ctx.condominioId };
  }
  return next(params);
});
```

**Trade-off:** Compartilhado vs. database-per-tenant. Escolhemos compartilhado porque: operação mais simples para um SaaS com muitos condomínios pequenos; migrations únicas; custo menor. O RLS é porta de mão dupla — pode ser removido se a complexidade não valer a pena.

**Motivação na spec:** `cadastro/spec.md` — 403 em acesso cross-tenant; `financeiro`, `comunicacao`, `reservas`, `assembleias`, `ocorrencias` — todos exigem isolamento por condomínio.

### 3.3 Validação / Schema

| Decisão | Biblioteca |
|---------|-----------|
| Validação de entrada | **Zod** `^3` |

**Justificativa:** Inferência direta de tipos TypeScript; composição de schemas sem duplicação; integração nativa com Next.js Route Handlers via `request.json()`.

```typescript
// Exemplo: schema de cobrança
const CriarCobrancaSchema = z.object({
  tipo: z.enum(['taxa_mensal', 'fundo_reserva', 'extra_rateio', 'multa_juros', 'consumo']),
  valor: z.number().positive(),
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  vencimento: z.string().datetime(),
  unidadeId: z.string().uuid(),
});
```

**Motivação na spec:** Todos os módulos exigem rejeição com erro de validação para campos fora da lista ou ausentes.

### 3.4 AuthN / AuthZ

| Decisão | Biblioteca/Abordagem |
|---------|---------------------|
| Autenticação | **Auth.js v5** (NextAuth) |
| JWT | Auth.js com claims de tenant + perfil |
| Autorização (RBAC) | Middleware próprio sobre claims do JWT |

**6 perfis do sistema (da spec):**

```typescript
export enum PerfilUsuario {
  SINDICO = 'sindico',
  ADMINISTRADORA = 'administradora',
  PROPRIETARIO = 'proprietario',
  INQUILINO = 'inquilino',
  PORTEIRO = 'porteiro',
  CONSELHO = 'conselho',
}
```

**JWT payload:**

```typescript
interface SessionPayload {
  sub: string;         // userId
  condominioId: string; // tenant
  perfil: PerfilUsuario;
  vinculoId?: string;  // id do vínculo pessoa↔unidade se aplicável
}
```

**Middleware de autorização:**

```typescript
// lib/auth/rbac.ts
export function requirePerfil(...perfis: PerfilUsuario[]) {
  return (handler: RouteHandler) => async (req: Request, ctx: RouteContext) => {
    const session = await getServerSession();
    if (!perfis.includes(session.perfil)) return forbidden();
    return handler(req, ctx);
  };
}
```

**Motivação na spec:** `comunicacao/spec.md` — apenas `sindico`, `administradora`, `porteiro`, `conselho` publicam; `assembleias-votacoes/spec.md` — inadimplente não vota; `reservas-areas-comuns/spec.md` — inadimplente não reserva.

### 3.5 Pagamentos: Boleto + Pix e Conciliação

| Decisão | Abordagem |
|---------|----------|
| PSP (boleto + Pix) | **Efí Bank (Gerencianet)** — `sdk-node-apis-efi` |
| Conciliação | Webhook do PSP + fila de processamento idempotente |

**Justificativa:** Efí Bank é PSP certificado pelo BACEN para API Pix (modalidades COB, COBV, QR Dinâmico) e emite boleto bancário registrado via API REST. SDK Node.js oficial mantido (`sdk-node-apis-efi`). Alternativas avaliadas:
- **Asaas:** boa integração, mas custo por transação mais elevado para volume de condomínio e SDK menos tipado.
- **Pagar.me v5:** maior volume/SLA, porém onboarding mais lento e SDK com menos suporte a Pix avançado.

O adapter é isolado em `infrastructure/payments/` (interface `PaymentProvider`) para facilitar troca futura — decisão reversível.

**Variáveis de ambiente PSP (Efí Bank):**
```bash
EFI_CLIENT_ID=...
EFI_CLIENT_SECRET=...
EFI_PIX_CERT_PATH=./certs/efi-cert.p12   # Certificado mTLS obrigatório para API Pix
EFI_PIX_CERT_PASSPHRASE=...
EFI_SANDBOX=false                          # true em dev/staging
```

**Interface do adapter (porta):**

```typescript
interface PaymentProvider {
  criarCobrancaBoleto(params: BoletoParams): Promise<BoletoResult>;
  criarCobrancaPix(params: PixParams): Promise<PixResult>;
  cancelarCobranca(externalId: string): Promise<void>;
}
```

**Conciliação idempotente:**

```typescript
// Cada webhook tem idempotencyKey = PSP transaction ID
// Gravado na tabela pagamentos com UNIQUE constraint
// Segundo processamento do mesmo webhook é no-op (upsert com conflict do nothing)
```

**Motivação na spec:** `financeiro/spec.md` — boleto E Pix; conciliação automática; pagamento por um método encerra os demais; falha na integração não grava dados; idempotência contra webhooks duplicados.

### 3.6 Notificações / Canais e Fila de Jobs

| Canal | Biblioteca/Provedor |
|-------|-------------------|
| `in_app` | WebSocket/SSE ou polling — dado persistido no banco |
| `email` | **Resend** (API simples, boa entregabilidade) |
| `push` | **Firebase Admin SDK** (FCM) |
| `sms_whatsapp` | **Twilio** (SMS) + **Z-API** ou **Evolution API** (WhatsApp Business) |
| Fila assíncrona | **BullMQ** + **Redis** (Upstash em produção) |
| Cron/jobs agendados | BullMQ Scheduler (repeatable jobs) |

**Justificativa BullMQ:** mature, TypeScript-first, retry com backoff exponencial, Dead Letter Queue, monitoramento via Bull Board. Redis é porta de mão dupla — Upstash para serverless, Redis dedicado para on-premise.

**Worker de notificação:**

```typescript
// infrastructure/queue/workers/notification.worker.ts
notificationQueue.process(async (job) => {
  const { canal, destinatario, payload } = job.data;
  // Tenta todos os canais em paralelo; falha de um não bloqueia os outros
  await Promise.allSettled([
    sendEmail(destinatario, payload),
    sendPush(destinatario, payload),
    sendSmsWhatsapp(destinatario, payload),
  ]);
  await markInAppDelivered(destinatario, payload);
});
```

**Motivação na spec:** `comunicacao/spec.md` — 4 canais; falha em um canal não bloqueia os outros; status de envio por canal/destinatário. `ocorrencias-manutencao/spec.md` — notificação do autor a cada mudança. `assembleias-votacoes/spec.md` — notificação do resultado.

### 3.7 Agendamento / Conflito de Reservas

| Necessidade | Abordagem |
|------------|----------|
| Verificação de disponibilidade | Query SQL com lock pessimista (`SELECT FOR UPDATE`) durante transação |
| Granularidades (`dia_inteiro`, `turno`, `horario`) | Campos `inicio` e `fim` (timestamp) + índice de exclusão no banco |
| Limite por unidade / antecedência | Validação em use-case antes de inserir |
| Jobs de SLA (`ocorrencias`) | BullMQ delayed job criado ao definir prazo; worker marca `sla_estourado` |
| Jobs de inadimplência (`financeiro`) | BullMQ repeatable job (diário) varre cobranças vencidas |

**Índice de exclusão para reservas exclusivas:**

```sql
-- Garante que duas reservas confirmadas não se sobreponham em área exclusiva
CREATE UNIQUE INDEX reservas_exclusiva_idx
  ON "Reserva" ("areaId", "inicio", "fim")
  WHERE status = 'confirmada' AND politica = 'exclusiva';
```

**Motivação na spec:** `reservas-areas-comuns/spec.md` — política de conflito; antecedência; limite por unidade. `ocorrencias-manutencao/spec.md` — SLA sinalizado quando estourado.

### 3.8 Armazenamento de Arquivos

| Decisão | Abordagem |
|---------|----------|
| Storage | **AWS S3** ou **Cloudflare R2** (S3-compatible) |
| SDK | `@aws-sdk/client-s3` |
| Acesso | URLs pré-assinadas (expiram em 1h) |

**Motivação na spec:** `ocorrencias-manutencao/spec.md` — anexos/fotos associados a ocorrências.

### 3.9 Auditoria e Log

| Necessidade | Abordagem |
|------------|----------|
| Auditoria de votos (assembleias) | Tabela `VotoAuditoria` append-only; gravada junto ao voto em transação |
| Auditoria de conciliação financeira | Tabela `ConciliacaoLog` com `externalId`, `method`, `timestamp` |
| Log estruturado de aplicação | **Pino** (performático, JSON-first, integra com plataformas de log) |
| Rastreamento de mudanças de status (ocorrências) | Tabela `OcorrenciaHistorico` append-only |

**Motivação na spec:** `assembleias-votacoes/spec.md` — histórico auditável; voto secreto (agregado sem identidade); `financeiro/spec.md` — conciliação registrada por método/data/valor.

### 3.10 Testes

| Camada | Ferramenta |
|-------|-----------|
| Unitários (domínio/use-cases) | **Vitest** |
| Integração (route handlers + DB) | Vitest + **Testcontainers** (PostgreSQL efêmero) |
| Contratos de API | **Zod** schemas como source of truth |
| Mocks externos (PSP, FCM, etc.) | **MSW** (Mock Service Worker) |

**Justificativa Vitest:** nativo ESM, configuração mínima com TypeScript, API compatível com Jest, modo `--watch` rápido.

**Motivação na spec:** Cada módulo exige cenários de rejeição testáveis (tipo inválido, campo ausente, 403 cross-tenant) — os schemas Zod já cobrem grande parte deles como casos de teste automatizados.

---

## 4. Decisões Transversais

### 4.1 Multi-tenant — Estratégia de Isolamento

| Decisão | Escolha | Alternativa descartada |
|---------|---------|----------------------|
| Modelo de tenant | Shared DB, `condominioId` por registro | Database-per-tenant |
| Enforcement | Middleware Prisma + PostgreSQL RLS | Só aplicação |
| Contexto do tenant | JWT claim `condominioId` | Header `X-Tenant-Id` |

**Por que não database-per-tenant:** operação complexa (N instâncias de banco, migrations N vezes), custo proibitivo para condomínios pequenos, benefício de isolamento marginal frente a RLS bem configurado.

**Porta de mão dupla:** o Prisma middleware de tenant é injetável — se um condomínio de grande porte exigir isolamento maior no futuro, pode-se rotear para um banco dedicado sem mudar o domínio.

### 4.2 Tratamento de Erros

Padrão único de resposta de erro em toda a API:

```typescript
interface ApiError {
  code: string;       // ex.: "VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND"
  message: string;    // mensagem legível
  details?: unknown;  // erros de campo do Zod, etc.
}
```

| HTTP Status | Quando |
|-------------|--------|
| 400 | Erro de validação (Zod) |
| 401 | Não autenticado |
| 403 | Autenticado mas sem permissão (RBAC ou cross-tenant) |
| 404 | Recurso não encontrado |
| 409 | Conflito (duplicidade, reserva indisponível, voto duplicado) |
| 422 | Regra de negócio violada (quórum, SLA, etc.) |
| 500 | Erro interno (nunca exponha stack traces em produção) |

### 4.3 Paginação

Cursor-based por padrão (estável para conjuntos que mudam frequentemente):

```typescript
interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total?: number; // opcional, para relatórios
}
```

Query params: `?cursor=<opaque>&limit=<1-100, default 20>`.

Offset-based permitido apenas para relatórios estáticos (ex.: inadimplentes).

### 4.4 Idempotência

| Cenário | Mecanismo |
|---------|----------|
| Webhook de pagamento duplicado | `UNIQUE` em `ConciliacaoLog.externalTransactionId` |
| Retry de emissão boleto/Pix | `UNIQUE` em `CobrancaEmissao.externalId` |
| Voto duplicado em assembleia | `UNIQUE(assembleiaItemId, unidadeId)` na tabela de votos |
| Requests com `Idempotency-Key` header | Cache Redis de 24h por `(userId, idempotencyKey)` |

**Motivação na spec:** `financeiro/spec.md` — pagamento por Pix encerra boleto da mesma cobrança; `assembleias-votacoes/spec.md` — voto em duplicidade rejeitado.

### 4.5 Versionamento da API

Prefixo de versão na URL: `/api/v1/...`

Estratégia: versionamento por URL (porta de mão dupla). Versões antigas mantidas por 6 meses após deprecação. Breaking changes geram nova versão.

### 4.6 Variáveis de Ambiente e Segredos

Gerenciamento via `.env` (local) e serviço de secrets em produção (AWS Secrets Manager, Vercel Env, ou equivalente). **Nunca commitados no repositório.**

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...     # sem pooler para prisma migrate

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...

# PSP — Efí Bank (Gerencianet)
EFI_CLIENT_ID=...
EFI_CLIENT_SECRET=...
EFI_PIX_CERT_PATH=./certs/efi-cert.p12
EFI_PIX_CERT_PASSPHRASE=...
EFI_SANDBOX=false

# Notificações
RESEND_API_KEY=...
FIREBASE_SERVICE_ACCOUNT_JSON=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+55...

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
S3_BUCKET=...

# Redis/Queue
REDIS_URL=...
```

Variáveis injetadas no build por Next.js (`env:` no `next.config.ts`) — somente as prefixadas `NEXT_PUBLIC_` são expostas ao cliente.

---

## 5. Mapeamento Specs → Decisões

| Spec / Requisito | Decisão ARD |
|-----------------|-------------|
| `cadastro` — isolamento multi-tenant (403 cross-tenant) | §3.2 Prisma middleware + RLS |
| `cadastro` — CPF único por condomínio | `UNIQUE(condominioId, cpf)` no schema Prisma |
| `financeiro` — boleto E Pix | §3.5 PSP unificado (Efí Bank/Gerencianet) |
| `financeiro` — conciliação automática, idempotente | §3.5 webhook + §4.4 UNIQUE externalTransactionId |
| `financeiro` — inadimplência automática | §3.7 BullMQ repeatable job diário |
| `comunicacao` — 4 canais, falha de um não bloqueia | §3.6 Promise.allSettled + BullMQ |
| `comunicacao` — perfis que publicam (RBAC) | §3.4 requirePerfil middleware |
| `reservas-areas-comuns` — conflito exclusiva/capacidade | §3.7 SELECT FOR UPDATE + índice de exclusão |
| `reservas-areas-comuns` — taxa → Financeiro | Application use-case orquestra cobrança pós-confirmação |
| `assembleias-votacoes` — voto secreto | Campo `secreto` por pauta; query de apuração agrega sem identidade |
| `assembleias-votacoes` — histórico auditável | §3.9 tabela `VotoAuditoria` append-only |
| `assembleias-votacoes` — notificação resultado → Comunicação | Application chama use-case de comunicação após apuração |
| `ocorrencias-manutencao` — SLA estourado | §3.7 BullMQ delayed job |
| `ocorrencias-manutencao` — anexos | §3.8 S3/R2 com URL pré-assinada |
| `ocorrencias-manutencao` — fluxo configurável | Tabela `FluxoStatus` por condomínio; validação de transição no use-case |
| *(todos os módulos)* — paginação | §4.3 cursor-based default |
| *(todos os módulos)* — validação de entrada | §3.3 Zod schemas |
| *(todos os módulos)* — 6 perfis RBAC | §3.4 PerfilUsuario enum + requirePerfil |

---

## 6. Portaria/Acessos

Spec consolidada em `openspec/changes/condominio-backend-scope/specs/portaria-acessos/spec.md`.

**Requisitos e impacto no stack:**

| Requisito | Mecanismo ARD |
|-----------|--------------|
| Registro de acesso por tipo (visitante, prestador, entrega, veículo) | Tabela `RegistroAcesso` multi-tenant (§3.2); tipos via enum Prisma |
| Dois fluxos de autorização: pré-autorização e confirmação na chegada | Application use-cases distintos; status `pre_autorizado` \| `aguardando_confirmacao` \| `autorizado` \| `negado` |
| Confirmação em tempo real pelo morador | Notificação push (FCM §3.6) ao morador; resposta via route handler; timeout configurável |
| Gestão de encomendas (foto/etiqueta) | Anexos via S3/R2 (§3.8); notificação ao morador via BullMQ (§3.6) |
| Histórico auditável por condomínio e período | Tabela append-only com `condominioId` + índice em `criadoEm`; paginação cursor (§4.3) |
| Isolamento de dados por condomínio | §3.2 Prisma middleware + RLS padrão |

**Novos modelos Prisma adicionados por este módulo:**

```prisma
model RegistroAcesso {
  id           String        @id @default(cuid())
  condominioId String
  tipo         TipoAcesso    // VISITANTE | PRESTADOR | ENTREGA | VEICULO
  nomeVisitante String
  documento    String?
  unidadeDestinoId String
  autorizadorId   String?
  entrada      DateTime
  saida        DateTime?
  status       StatusAcesso  // AGUARDANDO | AUTORIZADO | NEGADO
  criadoEm    DateTime      @default(now())

  @@index([condominioId, criadoEm])
  @@index([condominioId, unidadeDestinoId])
}

model Encomenda {
  id           String   @id @default(cuid())
  condominioId String
  unidadeId    String
  remetente    String?
  fotoUrl      String?  // URL pré-assinada S3/R2
  recebidaEm  DateTime @default(now())
  retiradaEm  DateTime?
  retiradorId  String?
}
```

**Nenhuma lib nova necessária** — fluxos cobertos por Auth.js, BullMQ, S3 e Pino já definidos.

---

## 7. Decisões Reversíveis vs. Porta de Mão Única

| Decisão | Reversibilidade | Notas |
|---------|----------------|-------|
| PostgreSQL como banco | Porta de mão única (alto custo de migração) | Justificada pelo RLS nativo e maturidade |
| Prisma como ORM | Reversível com esforço médio | Interface de repositório pode isolar |
| Shared DB multi-tenant | Reversível para database-per-tenant por tenant | Adapter Prisma já prevê roteamento |
| PSP (Efí Bank) | Reversível — interface `PaymentProvider` abstrai o provedor | Trocar se volume justificar renegociação |
| BullMQ + Redis para filas | Reversível para outro broker | Workers encapsulados em `infrastructure/queue/` |
| Auth.js para AuthN | Reversível com médio esforço | JWT payload padronizado |
| Resend para e-mail | Reversível facilmente | Interface de notificação abstrai provedor |

---

## 8. Checklist de Conformidade

Antes de cada PR de feature ser aprovado, verificar:

- [ ] Toda query Prisma inclui `condominioId` no filtro (ou passa pelo middleware de tenant)
- [ ] Schemas Zod cobrem todos os campos obrigatórios e enums da spec
- [ ] Perfis autorizados conferem com a spec do módulo
- [ ] Webhooks de pagamento usam `idempotencyKey` (sem dupla conciliação)
- [ ] Jobs BullMQ têm retry configurado e Dead Letter Queue
- [ ] Segredos NÃO estão em código ou logs
- [ ] Erros de cross-tenant retornam 403 (não 404)

---

*Este ARD v1.1.0 cobre todas as 7 specs OpenSpec consolidadas (incluindo `portaria-acessos`). Qualquer desvio técnico deve ser registrado aqui como revisão numerada antes de ser implementado.*

| Revisão | Data | Mudança |
|---------|------|---------|
| 1.0.0 | 2026-06-04 | Versão inicial — 6 specs consolidadas |
| 1.1.0 | 2026-06-04 | PSP definido (Efí Bank); portaria-acessos preenchida; vars de ambiente refinadas |
