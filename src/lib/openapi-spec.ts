// OpenAPI 3.0.x spec — typed inline to avoid external type dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaObj = Record<string, any>;

const bearerAuth: SchemaObj = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Session JWT from NextAuth. Obtain via POST /api/auth/signin.",
};

const sessionCookie: SchemaObj = {
  type: "apiKey",
  in: "cookie",
  name: "next-auth.session-token",
  description: "NextAuth session cookie (set automatically by the browser after sign-in).",
};

const pageable: SchemaObj[] = [
  { name: "cursor", in: "query", schema: { type: "string" }, description: "Cursor for pagination (last seen id)." },
  { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Number of items to return." },
];

const condominioIdParam: SchemaObj = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Condominium ID (tenant context).",
};

const pageSchema: SchemaObj = {
  type: "object",
  properties: {
    data: { type: "array", items: {} },
    nextCursor: { type: "string", nullable: true },
    hasMore: { type: "boolean" },
  },
};

const errorSchema: SchemaObj = {
  type: "object",
  properties: {
    error: { type: "string" },
    fieldErrors: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
  },
};

const spec: SchemaObj = {
  openapi: "3.0.3",
  info: {
    title: "Condomínio Legal API",
    version: "1.0.0",
    description: `
REST API for the Condomínio Legal platform. All protected endpoints require authentication via Bearer JWT or session cookie (NextAuth).

**Modules:**
- Cadastro (condominiums, units, people, bindings)
- Comunicação (announcements)
- Assembleias (meetings & voting)
- Financeiro (billing, PIX, boleto)
- Portaria (access control, packages, pre-authorizations)
- Ocorrências (incidents)
- Reservas (common areas & reservations)
- Auth & Health
    `.trim(),
    contact: { name: "Codespec", email: "leandro@codespec.com.br" },
  },
  servers: [
    { url: "http://localhost:3001", description: "Local dev" },
    { url: "https://api.condominiolegal.com.br", description: "Production" },
  ],
  components: {
    securitySchemes: {
      bearerAuth,
      sessionCookie,
    },
    schemas: {
      Page: pageSchema,
      Error: errorSchema,
      Condominio: {
        type: "object",
        properties: {
          id: { type: "string" },
          nome: { type: "string" },
          cnpj: { type: "string", example: "12345678000195" },
          endereco: { type: "string" },
          multaAtraso: { type: "number", nullable: true },
          jurosMensal: { type: "number", nullable: true },
          criadoEm: { type: "string", format: "date-time" },
          atualizadoEm: { type: "string", format: "date-time" },
        },
      },
      CriarCondominio: {
        type: "object",
        required: ["nome", "cnpj", "endereco"],
        properties: {
          nome: { type: "string", minLength: 2, maxLength: 200 },
          cnpj: { type: "string", pattern: "^\\d{14}$", example: "12345678000195" },
          endereco: { type: "string", minLength: 5, maxLength: 500 },
          multaAtraso: { type: "number", minimum: 0, maximum: 100 },
          jurosMensal: { type: "number", minimum: 0, maximum: 100 },
        },
      },
      Unidade: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          bloco: { type: "string", nullable: true },
          numero: { type: "string" },
          tipo: { type: "string", enum: ["APARTAMENTO", "CASA", "COMERCIAL", "GARAGEM", "DEPOSITO"] },
          fracaoIdeal: { type: "number", nullable: true },
        },
      },
      CriarUnidade: {
        type: "object",
        required: ["numero"],
        properties: {
          bloco: { type: "string", maxLength: 20 },
          numero: { type: "string", minLength: 1, maxLength: 20 },
          tipo: { type: "string", enum: ["APARTAMENTO", "CASA", "COMERCIAL", "GARAGEM", "DEPOSITO"] },
          fracaoIdeal: { type: "number", minimum: 0, maximum: 100 },
        },
      },
      Pessoa: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          nome: { type: "string" },
          cpf: { type: "string", example: "12345678901" },
          email: { type: "string", format: "email" },
          telefone: { type: "string" },
        },
      },
      CriarPessoa: {
        type: "object",
        required: ["nome", "cpf", "email", "telefone"],
        properties: {
          nome: { type: "string", minLength: 2, maxLength: 200 },
          cpf: { type: "string", pattern: "^\\d{11}$", example: "12345678901" },
          email: { type: "string", format: "email" },
          telefone: { type: "string", minLength: 10, maxLength: 20 },
        },
      },
      Vinculo: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          pessoaId: { type: "string" },
          unidadeId: { type: "string" },
          papel: { type: "string", enum: ["proprietario", "inquilino", "morador", "responsavel_financeiro", "imobiliaria"] },
          perfil: { type: "string", enum: ["sindico", "administradora", "proprietario", "inquilino", "porteiro", "conselho"] },
        },
      },
      CriarVinculo: {
        type: "object",
        required: ["userId", "pessoaId", "unidadeId", "papel", "perfil"],
        properties: {
          userId: { type: "string" },
          pessoaId: { type: "string" },
          unidadeId: { type: "string" },
          papel: { type: "string", enum: ["proprietario", "inquilino", "morador", "responsavel_financeiro", "imobiliaria"] },
          perfil: { type: "string", enum: ["sindico", "administradora", "proprietario", "inquilino", "porteiro", "conselho"] },
        },
      },
      Comunicado: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          titulo: { type: "string" },
          corpo: { type: "string" },
          autorId: { type: "string" },
          criadoEm: { type: "string", format: "date-time" },
        },
      },
      CriarComunicado: {
        type: "object",
        required: ["titulo", "corpo"],
        properties: {
          titulo: { type: "string" },
          corpo: { type: "string" },
          perfisDestinatarios: {
            type: "array",
            items: { type: "string", enum: ["sindico", "administradora", "proprietario", "inquilino", "porteiro", "conselho"] },
          },
        },
      },
      Assembleia: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          tipo: { type: "string", enum: ["ORDINARIA", "EXTRAORDINARIA"] },
          dataHora: { type: "string", format: "date-time" },
          local: { type: "string" },
          status: { type: "string", enum: ["AGENDADA", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"] },
          quorumMinimo: { type: "number" },
          votacaoSecreta: { type: "boolean" },
          itensPauta: { type: "array", items: { $ref: "#/components/schemas/ItemPauta" } },
        },
      },
      ConvocarAssembleia: {
        type: "object",
        required: ["tipo", "dataHora", "local", "itensPauta"],
        properties: {
          tipo: { type: "string", enum: ["ORDINARIA", "EXTRAORDINARIA"] },
          dataHora: { type: "string", format: "date-time" },
          local: { type: "string" },
          quorumMinimo: { type: "number" },
          votacaoSecreta: { type: "boolean", default: false },
          itensPauta: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["descricao"],
              properties: {
                descricao: { type: "string" },
                ordem: { type: "integer" },
              },
            },
          },
        },
      },
      ItemPauta: {
        type: "object",
        properties: {
          id: { type: "string" },
          assembleiaId: { type: "string" },
          descricao: { type: "string" },
          ordem: { type: "integer" },
        },
      },
      Cobranca: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          unidadeId: { type: "string" },
          valor: { type: "number" },
          vencimento: { type: "string", format: "date" },
          status: { type: "string", enum: ["PENDENTE", "PAGO", "VENCIDO", "CANCELADO"] },
          descricao: { type: "string" },
        },
      },
      CriarCobranca: {
        type: "object",
        required: ["unidadeId", "valor", "vencimento"],
        properties: {
          unidadeId: { type: "string" },
          valor: { type: "number", minimum: 0.01 },
          vencimento: { type: "string", format: "date" },
          descricao: { type: "string" },
        },
      },
      Acesso: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          nome: { type: "string" },
          documento: { type: "string", nullable: true },
          motivoVisita: { type: "string" },
          unidadeDestinoId: { type: "string" },
          status: { type: "string", enum: ["AGUARDANDO", "AUTORIZADO", "NEGADO", "SAIU"] },
          entrada: { type: "string", format: "date-time", nullable: true },
          saida: { type: "string", format: "date-time", nullable: true },
        },
      },
      CriarAcesso: {
        type: "object",
        required: ["nome", "motivoVisita", "unidadeDestinoId"],
        properties: {
          nome: { type: "string" },
          documento: { type: "string" },
          motivoVisita: { type: "string" },
          unidadeDestinoId: { type: "string" },
        },
      },
      Encomenda: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          unidadeId: { type: "string" },
          descricao: { type: "string" },
          remetente: { type: "string", nullable: true },
          status: { type: "string", enum: ["AGUARDANDO_RETIRADA", "RETIRADA"] },
          recebidaEm: { type: "string", format: "date-time" },
          retiradaEm: { type: "string", format: "date-time", nullable: true },
        },
      },
      Ocorrencia: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          titulo: { type: "string" },
          descricao: { type: "string" },
          categoria: { type: "string" },
          status: { type: "string", enum: ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "ENCERRADA"] },
          prioridade: { type: "string", enum: ["BAIXA", "MEDIA", "ALTA", "URGENTE"] },
          criadoEm: { type: "string", format: "date-time" },
        },
      },
      CriarOcorrencia: {
        type: "object",
        required: ["titulo", "descricao", "categoria"],
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string" },
          categoria: { type: "string" },
          prioridade: { type: "string", enum: ["BAIXA", "MEDIA", "ALTA", "URGENTE"] },
          unidadeId: { type: "string" },
        },
      },
      AreaComum: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          nome: { type: "string" },
          capacidade: { type: "integer", nullable: true },
          antecedenciaMaxDias: { type: "integer" },
          antecedenciaMinHoras: { type: "integer" },
          ativa: { type: "boolean" },
        },
      },
      Reserva: {
        type: "object",
        properties: {
          id: { type: "string" },
          condominioId: { type: "string" },
          areaComumId: { type: "string" },
          unidadeId: { type: "string" },
          inicio: { type: "string", format: "date-time" },
          fim: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["PENDENTE", "APROVADA", "REJEITADA", "CANCELADA"] },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { sessionCookie: [] }],
  tags: [
    { name: "Health", description: "Liveness and version checks." },
    { name: "Auth", description: "Authentication and session." },
    { name: "Cadastro — Condomínios", description: "Manage condominiums." },
    { name: "Cadastro — Unidades", description: "Manage units inside a condominium." },
    { name: "Cadastro — Pessoas", description: "Manage people / contacts." },
    { name: "Cadastro — Vínculos", description: "User–unit role bindings." },
    { name: "Comunicação", description: "Announcements and delivery receipts." },
    { name: "Assembleias", description: "Meetings, agenda items, voting, and minutes." },
    { name: "Financeiro", description: "Billing charges, boleto, PIX, and delinquency." },
    { name: "Portaria — Acessos", description: "Visitor access control." },
    { name: "Portaria — Encomendas", description: "Package management." },
    { name: "Portaria — Pré-autorizações", description: "Pre-authorized visitors." },
    { name: "Ocorrências", description: "Incident management and workflow." },
    { name: "Reservas — Áreas Comuns", description: "Common area catalog." },
    { name: "Reservas", description: "Reservation requests and approvals." },
    { name: "Webhooks", description: "External webhook receivers." },
  ],
  paths: {
    // ── Health ────────────────────────────────────────────────────────────────
    "/api/v1/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        operationId: "getHealth",
        security: [],
        responses: {
          "200": { description: "Service is healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } } },
        },
      },
    },

    // ── Auth ──────────────────────────────────────────────────────────────────
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user session",
        operationId: "getMe",
        responses: {
          "200": {
            description: "Session claims",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: { type: "string" },
                    email: { type: "string" },
                    condominioId: { type: "string", nullable: true },
                    perfil: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthenticated" },
        },
      },
    },

    // ── Cadastro — Condomínios ─────────────────────────────────────────────────
    "/api/v1/cadastro/condominios": {
      get: {
        tags: ["Cadastro — Condomínios"],
        summary: "List condominiums",
        operationId: "listCondominios",
        parameters: pageable,
        responses: {
          "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Condominio" } } } }] } } } },
          "401": { description: "Unauthenticated" },
          "403": { description: "Forbidden — insufficient perfil" },
        },
      },
      post: {
        tags: ["Cadastro — Condomínios"],
        summary: "Create condominium",
        operationId: "createCondominio",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarCondominio" } } } },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Condominio" } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "CNPJ already registered" },
        },
      },
    },
    "/api/v1/cadastro/condominios/{id}": {
      get: {
        tags: ["Cadastro — Condomínios"],
        summary: "Get condominium",
        operationId: "getCondominio",
        parameters: [condominioIdParam],
        responses: {
          "200": { description: "Condominium", content: { "application/json": { schema: { $ref: "#/components/schemas/Condominio" } } } },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        tags: ["Cadastro — Condomínios"],
        summary: "Update condominium",
        operationId: "updateCondominio",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarCondominio" } } } },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Condominio" } } } },
          "400": { description: "Validation error" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },

    // ── Cadastro — Unidades ───────────────────────────────────────────────────
    "/api/v1/cadastro/condominios/{id}/unidades": {
      get: {
        tags: ["Cadastro — Unidades"],
        summary: "List units",
        operationId: "listUnidades",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Unidade" } } } }] } } } } },
      },
      post: {
        tags: ["Cadastro — Unidades"],
        summary: "Create unit",
        operationId: "createUnidade",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarUnidade" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Unidade" } } } }, "400": { description: "Validation error" } },
      },
    },
    "/api/v1/cadastro/condominios/{id}/unidades/{unidadeId}": {
      get: {
        tags: ["Cadastro — Unidades"],
        summary: "Get unit",
        operationId: "getUnidade",
        parameters: [condominioIdParam, { name: "unidadeId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Unit", content: { "application/json": { schema: { $ref: "#/components/schemas/Unidade" } } } } },
      },
      patch: {
        tags: ["Cadastro — Unidades"],
        summary: "Update unit",
        operationId: "updateUnidade",
        parameters: [condominioIdParam, { name: "unidadeId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarUnidade" } } } },
        responses: { "200": { description: "Updated" } },
      },
    },

    // ── Cadastro — Pessoas ────────────────────────────────────────────────────
    "/api/v1/cadastro/condominios/{id}/pessoas": {
      get: {
        tags: ["Cadastro — Pessoas"],
        summary: "List people",
        operationId: "listPessoas",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Pessoa" } } } }] } } } } },
      },
      post: {
        tags: ["Cadastro — Pessoas"],
        summary: "Create person",
        operationId: "createPessoa",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarPessoa" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Pessoa" } } } } },
      },
    },
    "/api/v1/cadastro/condominios/{id}/pessoas/{pessoaId}": {
      get: {
        tags: ["Cadastro — Pessoas"],
        summary: "Get person",
        operationId: "getPessoa",
        parameters: [condominioIdParam, { name: "pessoaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Person", content: { "application/json": { schema: { $ref: "#/components/schemas/Pessoa" } } } } },
      },
      patch: {
        tags: ["Cadastro — Pessoas"],
        summary: "Update person",
        operationId: "updatePessoa",
        parameters: [condominioIdParam, { name: "pessoaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarPessoa" } } } },
        responses: { "200": { description: "Updated" } },
      },
    },

    // ── Cadastro — Vínculos ───────────────────────────────────────────────────
    "/api/v1/cadastro/condominios/{id}/vinculos": {
      get: {
        tags: ["Cadastro — Vínculos"],
        summary: "List bindings",
        operationId: "listVinculos",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Vinculo" } } } }] } } } } },
      },
      post: {
        tags: ["Cadastro — Vínculos"],
        summary: "Create binding",
        operationId: "createVinculo",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarVinculo" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Vinculo" } } } } },
      },
    },
    "/api/v1/cadastro/vinculos/{vinculoId}": {
      delete: {
        tags: ["Cadastro — Vínculos"],
        summary: "Delete binding",
        operationId: "deleteVinculo",
        parameters: [{ name: "vinculoId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "204": { description: "Deleted" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
    },

    // ── Comunicação ───────────────────────────────────────────────────────────
    "/api/v1/comunicacao/condominios/{id}/comunicados": {
      get: {
        tags: ["Comunicação"],
        summary: "List announcements",
        operationId: "listComunicados",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Comunicado" } } } }] } } } } },
      },
      post: {
        tags: ["Comunicação"],
        summary: "Create announcement",
        operationId: "createComunicado",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarComunicado" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Comunicado" } } } } },
      },
    },
    "/api/v1/comunicacao/condominios/{id}/comunicados/{comunicadoId}": {
      get: {
        tags: ["Comunicação"],
        summary: "Get announcement",
        operationId: "getComunicado",
        parameters: [condominioIdParam, { name: "comunicadoId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Announcement", content: { "application/json": { schema: { $ref: "#/components/schemas/Comunicado" } } } } },
      },
    },
    "/api/v1/comunicacao/condominios/{id}/comunicados/{comunicadoId}/ciencia": {
      post: {
        tags: ["Comunicação"],
        summary: "Acknowledge announcement",
        operationId: "acknowledgeAnnouncement",
        parameters: [condominioIdParam, { name: "comunicadoId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Acknowledged" } },
      },
    },
    "/api/v1/comunicacao/condominios/{id}/comunicados/{comunicadoId}/entregas": {
      get: {
        tags: ["Comunicação"],
        summary: "Get announcement delivery status",
        operationId: "getAnnouncementDeliveries",
        parameters: [condominioIdParam, { name: "comunicadoId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Delivery status list" } },
      },
    },

    // ── Assembleias ───────────────────────────────────────────────────────────
    "/api/v1/assembleias/condominios/{id}/assembleias": {
      get: {
        tags: ["Assembleias"],
        summary: "List assemblies",
        operationId: "listAssembleias",
        parameters: [condominioIdParam, ...pageable, { name: "status", in: "query", schema: { type: "string", enum: ["AGENDADA", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"] } }],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Assembleia" } } } }] } } } } },
      },
      post: {
        tags: ["Assembleias"],
        summary: "Convoke assembly",
        operationId: "convokeAssembleia",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ConvocarAssembleia" } } } },
        responses: { "201": { description: "Assembly convoked", content: { "application/json": { schema: { $ref: "#/components/schemas/Assembleia" } } } } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}": {
      get: {
        tags: ["Assembleias"],
        summary: "Get assembly",
        operationId: "getAssembleia",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Assembly", content: { "application/json": { schema: { $ref: "#/components/schemas/Assembleia" } } } } },
      },
      patch: {
        tags: ["Assembleias"],
        summary: "Update assembly status",
        operationId: "updateAssembleia",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["AGENDADA", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"] } } } } } },
        responses: { "200": { description: "Updated" } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}/itens": {
      get: {
        tags: ["Assembleias"],
        summary: "List agenda items",
        operationId: "listItensPauta",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Agenda items" } },
      },
      post: {
        tags: ["Assembleias"],
        summary: "Add agenda item",
        operationId: "addItemPauta",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["descricao"], properties: { descricao: { type: "string" }, ordem: { type: "integer" } } } } } },
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}/votar": {
      post: {
        tags: ["Assembleias"],
        summary: "Cast vote",
        operationId: "castVote",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["itemPautaId", "voto"], properties: { itemPautaId: { type: "string" }, voto: { type: "string", enum: ["SIM", "NAO", "ABSTENCAO"] } } } } } },
        responses: { "200": { description: "Vote registered" } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}/apurar": {
      post: {
        tags: ["Assembleias"],
        summary: "Count votes and finalize",
        operationId: "apurarAssembleia",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Results", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}/ata": {
      get: {
        tags: ["Assembleias"],
        summary: "Generate assembly minutes (ata)",
        operationId: "getAta",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Minutes document" } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}/notificar": {
      post: {
        tags: ["Assembleias"],
        summary: "Send result notification",
        operationId: "notifyAssembleiaResult",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Notifications sent" } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}/procuracoes": {
      get: {
        tags: ["Assembleias"],
        summary: "List proxy authorizations",
        operationId: "listProcuracoes",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Proxies" } },
      },
      post: {
        tags: ["Assembleias"],
        summary: "Register proxy authorization",
        operationId: "createProcuracao",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["procuradorId", "representadoId"], properties: { procuradorId: { type: "string" }, representadoId: { type: "string" } } } } } },
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/assembleias/condominios/{id}/assembleias/{assembleiaId}/auditoria": {
      get: {
        tags: ["Assembleias"],
        summary: "Get audit trail",
        operationId: "getAssembleiaAudit",
        parameters: [condominioIdParam, { name: "assembleiaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Audit log" } },
      },
    },

    // ── Financeiro ────────────────────────────────────────────────────────────
    "/api/v1/financeiro/condominios/{id}/cobrancas": {
      get: {
        tags: ["Financeiro"],
        summary: "List billing charges",
        operationId: "listCobrancas",
        parameters: [condominioIdParam, ...pageable, { name: "status", in: "query", schema: { type: "string", enum: ["PENDENTE", "PAGO", "VENCIDO", "CANCELADO"] } }],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Cobranca" } } } }] } } } } },
      },
      post: {
        tags: ["Financeiro"],
        summary: "Create billing charge",
        operationId: "createCobranca",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarCobranca" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Cobranca" } } } } },
      },
    },
    "/api/v1/financeiro/condominios/{id}/cobrancas/{cobrancaId}": {
      get: {
        tags: ["Financeiro"],
        summary: "Get charge",
        operationId: "getCobranca",
        parameters: [condominioIdParam, { name: "cobrancaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Charge", content: { "application/json": { schema: { $ref: "#/components/schemas/Cobranca" } } } } },
      },
      patch: {
        tags: ["Financeiro"],
        summary: "Update charge",
        operationId: "updateCobranca",
        parameters: [condominioIdParam, { name: "cobrancaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarCobranca" } } } },
        responses: { "200": { description: "Updated" } },
      },
    },
    "/api/v1/financeiro/condominios/{id}/cobrancas/{cobrancaId}/emitir-boleto": {
      post: {
        tags: ["Financeiro"],
        summary: "Generate boleto",
        operationId: "emitirBoleto",
        parameters: [condominioIdParam, { name: "cobrancaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Boleto PDF / barcode", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" }, codigoBarras: { type: "string" } } } } } } },
      },
    },
    "/api/v1/financeiro/condominios/{id}/cobrancas/{cobrancaId}/emitir-pix": {
      post: {
        tags: ["Financeiro"],
        summary: "Generate PIX code",
        operationId: "emitirPix",
        parameters: [condominioIdParam, { name: "cobrancaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "PIX payload", content: { "application/json": { schema: { type: "object", properties: { pixCopiaECola: { type: "string" }, qrCodeUrl: { type: "string" } } } } } } },
      },
    },
    "/api/v1/financeiro/condominios/{id}/inadimplentes": {
      get: {
        tags: ["Financeiro"],
        summary: "List delinquent accounts",
        operationId: "listInadimplentes",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Delinquent list" } },
      },
    },
    "/api/v1/financeiro/condominios/{id}/rateio": {
      post: {
        tags: ["Financeiro"],
        summary: "Allocate expenses (rateio)",
        operationId: "criarRateio",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["valor", "descricao", "competencia"], properties: { valor: { type: "number" }, descricao: { type: "string" }, competencia: { type: "string", format: "date" } } } } } },
        responses: { "201": { description: "Charges created for all units" } },
      },
    },

    // ── Portaria — Acessos ────────────────────────────────────────────────────
    "/api/v1/portaria/condominios/{id}/acessos": {
      get: {
        tags: ["Portaria — Acessos"],
        summary: "List accesses",
        operationId: "listAcessos",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Acesso" } } } }] } } } } },
      },
      post: {
        tags: ["Portaria — Acessos"],
        summary: "Register visitor",
        operationId: "registerAcesso",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarAcesso" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Acesso" } } } } },
      },
    },
    "/api/v1/portaria/condominios/{id}/acessos/{acessoId}/confirmar": {
      post: {
        tags: ["Portaria — Acessos"],
        summary: "Authorize visitor entry",
        operationId: "confirmAcesso",
        parameters: [condominioIdParam, { name: "acessoId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Entry authorized" } },
      },
    },
    "/api/v1/portaria/condominios/{id}/acessos/{acessoId}/saida": {
      post: {
        tags: ["Portaria — Acessos"],
        summary: "Record visitor exit",
        operationId: "recordExit",
        parameters: [condominioIdParam, { name: "acessoId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Exit recorded" } },
      },
    },

    // ── Portaria — Encomendas ─────────────────────────────────────────────────
    "/api/v1/portaria/condominios/{id}/encomendas": {
      get: {
        tags: ["Portaria — Encomendas"],
        summary: "List packages",
        operationId: "listEncomendas",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Encomenda" } } } }] } } } } },
      },
      post: {
        tags: ["Portaria — Encomendas"],
        summary: "Register package",
        operationId: "registerEncomenda",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["unidadeId", "descricao"], properties: { unidadeId: { type: "string" }, descricao: { type: "string" }, remetente: { type: "string" } } } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Encomenda" } } } } },
      },
    },
    "/api/v1/portaria/condominios/{id}/encomendas/{encId}/retirada": {
      patch: {
        tags: ["Portaria — Encomendas"],
        summary: "Record package pickup",
        operationId: "recordPickup",
        parameters: [condominioIdParam, { name: "encId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Pickup recorded" } },
      },
    },

    // ── Portaria — Pré-autorizações ───────────────────────────────────────────
    "/api/v1/portaria/condominios/{id}/pre-autorizacoes": {
      get: {
        tags: ["Portaria — Pré-autorizações"],
        summary: "List pre-authorizations",
        operationId: "listPreAutorizacoes",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list" } },
      },
      post: {
        tags: ["Portaria — Pré-autorizações"],
        summary: "Create pre-authorization",
        operationId: "createPreAutorizacao",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["nome"], properties: { nome: { type: "string" }, documento: { type: "string" }, validoAte: { type: "string", format: "date-time" } } } } } },
        responses: { "201": { description: "Created" } },
      },
    },

    // ── Ocorrências ───────────────────────────────────────────────────────────
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias": {
      get: {
        tags: ["Ocorrências"],
        summary: "List incidents",
        operationId: "listOcorrencias",
        parameters: [condominioIdParam, ...pageable, { name: "status", in: "query", schema: { type: "string", enum: ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "ENCERRADA"] } }],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Ocorrencia" } } } }] } } } } },
      },
      post: {
        tags: ["Ocorrências"],
        summary: "Open incident",
        operationId: "createOcorrencia",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CriarOcorrencia" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Ocorrencia" } } } } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias/{ocorrenciaId}": {
      get: {
        tags: ["Ocorrências"],
        summary: "Get incident",
        operationId: "getOcorrencia",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Incident", content: { "application/json": { schema: { $ref: "#/components/schemas/Ocorrencia" } } } } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias/{ocorrenciaId}/status": {
      patch: {
        tags: ["Ocorrências"],
        summary: "Update incident status",
        operationId: "updateOcorrenciaStatus",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "ENCERRADA"] } } } } } },
        responses: { "200": { description: "Status updated" } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias/{ocorrenciaId}/atribuir": {
      patch: {
        tags: ["Ocorrências"],
        summary: "Assign incident",
        operationId: "assignOcorrencia",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["responsavelId"], properties: { responsavelId: { type: "string" } } } } } },
        responses: { "200": { description: "Assigned" } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias/{ocorrenciaId}/comentarios": {
      get: {
        tags: ["Ocorrências"],
        summary: "List incident comments",
        operationId: "listOcorrenciaComments",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Comments" } },
      },
      post: {
        tags: ["Ocorrências"],
        summary: "Add comment to incident",
        operationId: "addOcorrenciaComment",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["texto"], properties: { texto: { type: "string" } } } } } },
        responses: { "201": { description: "Comment added" } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias/{ocorrenciaId}/historico": {
      get: {
        tags: ["Ocorrências"],
        summary: "Get incident history",
        operationId: "getOcorrenciaHistory",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "History log" } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias/{ocorrenciaId}/avaliar": {
      post: {
        tags: ["Ocorrências"],
        summary: "Rate incident resolution",
        operationId: "rateOcorrencia",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["nota"], properties: { nota: { type: "integer", minimum: 1, maximum: 5 }, comentario: { type: "string" } } } } } },
        responses: { "200": { description: "Rated" } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/ocorrencias/{ocorrenciaId}/anexos": {
      post: {
        tags: ["Ocorrências"],
        summary: "Request pre-signed upload URL",
        operationId: "requestAttachmentUrl",
        parameters: [condominioIdParam, { name: "ocorrenciaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["filename", "contentType"], properties: { filename: { type: "string" }, contentType: { type: "string" } } } } } },
        responses: { "200": { description: "Pre-signed URL", content: { "application/json": { schema: { type: "object", properties: { uploadUrl: { type: "string" }, key: { type: "string" } } } } } } },
      },
    },
    "/api/v1/ocorrencias/condominios/{id}/fluxo": {
      get: {
        tags: ["Ocorrências"],
        summary: "Get incident workflow config",
        operationId: "getOcorrenciaFluxo",
        parameters: [condominioIdParam],
        responses: { "200": { description: "Workflow config" } },
      },
      put: {
        tags: ["Ocorrências"],
        summary: "Update incident workflow config",
        operationId: "updateOcorrenciaFluxo",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Updated" } },
      },
    },

    // ── Reservas — Áreas Comuns ───────────────────────────────────────────────
    "/api/v1/reservas/condominios/{id}/areas-comuns": {
      get: {
        tags: ["Reservas — Áreas Comuns"],
        summary: "List common areas",
        operationId: "listAreasComuns",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/AreaComum" } } } }] } } } } },
      },
      post: {
        tags: ["Reservas — Áreas Comuns"],
        summary: "Create common area",
        operationId: "createAreaComum",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["nome"], properties: { nome: { type: "string" }, capacidade: { type: "integer" }, antecedenciaMaxDias: { type: "integer" }, antecedenciaMinHoras: { type: "integer" } } } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/AreaComum" } } } } },
      },
    },
    "/api/v1/reservas/condominios/{id}/areas-comuns/{areaId}": {
      get: {
        tags: ["Reservas — Áreas Comuns"],
        summary: "Get common area",
        operationId: "getAreaComum",
        parameters: [condominioIdParam, { name: "areaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Common area", content: { "application/json": { schema: { $ref: "#/components/schemas/AreaComum" } } } } },
      },
      patch: {
        tags: ["Reservas — Áreas Comuns"],
        summary: "Update common area",
        operationId: "updateAreaComum",
        parameters: [condominioIdParam, { name: "areaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Updated" } },
      },
    },

    // ── Reservas ───────────────────────────────────────────────────────────────
    "/api/v1/reservas/condominios/{id}/reservas": {
      get: {
        tags: ["Reservas"],
        summary: "List reservations",
        operationId: "listReservas",
        parameters: [condominioIdParam, ...pageable],
        responses: { "200": { description: "Paginated list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Page" }, { properties: { data: { items: { $ref: "#/components/schemas/Reserva" } } } }] } } } } },
      },
      post: {
        tags: ["Reservas"],
        summary: "Create reservation",
        operationId: "createReserva",
        parameters: [condominioIdParam],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["areaComumId", "unidadeId", "inicio", "fim"], properties: { areaComumId: { type: "string" }, unidadeId: { type: "string" }, inicio: { type: "string", format: "date-time" }, fim: { type: "string", format: "date-time" } } } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Reserva" } } } } },
      },
    },
    "/api/v1/reservas/condominios/{id}/reservas/{reservaId}": {
      get: {
        tags: ["Reservas"],
        summary: "Get reservation",
        operationId: "getReserva",
        parameters: [condominioIdParam, { name: "reservaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Reservation", content: { "application/json": { schema: { $ref: "#/components/schemas/Reserva" } } } } },
      },
    },
    "/api/v1/reservas/condominios/{id}/reservas/{reservaId}/aprovar": {
      post: {
        tags: ["Reservas"],
        summary: "Approve reservation",
        operationId: "approveReserva",
        parameters: [condominioIdParam, { name: "reservaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Approved" } },
      },
    },
    "/api/v1/reservas/condominios/{id}/reservas/{reservaId}/rejeitar": {
      post: {
        tags: ["Reservas"],
        summary: "Reject reservation",
        operationId: "rejectReserva",
        parameters: [condominioIdParam, { name: "reservaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { motivo: { type: "string" } } } } } },
        responses: { "200": { description: "Rejected" } },
      },
    },
    "/api/v1/reservas/condominios/{id}/reservas/{reservaId}/cancelar": {
      post: {
        tags: ["Reservas"],
        summary: "Cancel reservation",
        operationId: "cancelReserva",
        parameters: [condominioIdParam, { name: "reservaId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Cancelled" } },
      },
    },

    // ── Webhooks ──────────────────────────────────────────────────────────────
    "/api/webhooks/psp": {
      post: {
        tags: ["Webhooks"],
        summary: "PSP payment webhook",
        operationId: "pspWebhook",
        security: [],
        description: "Receives payment status updates from the payment service provider. Signature verified via webhook secret.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Webhook processed" }, "400": { description: "Invalid signature or payload" } },
      },
    },
  },
};

export default spec;
