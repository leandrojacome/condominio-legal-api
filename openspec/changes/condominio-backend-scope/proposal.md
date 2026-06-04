## Why

O board (Leandro) quer iniciar a especificação do **backend** de um software de gestão de condomínios. Antes de implementar, precisamos transformar a intenção do produto em requisitos claros, testáveis e sem ambiguidade, capturados em OpenSpec. Este change abre o escopo e conduz o brainstorm, atividade por atividade, com o board.

Escopo desta fase = **somente backend** (API / domínio / dados). Frontend e testes serão delegados depois pelo Chefe.

## What Changes

Brainstorm em andamento. As decisões da **Rodada 1 (escopo)** já foram tomadas pelo board e estão registradas abaixo. A partir delas, detalhamos uma capacidade por vez (deep-dive), começando por **Cadastros**.

### Decisões da Rodada 1 (board, 2026-06-04)
- **Arquitetura:** **multi-condomínio (multi-tenant)** — uma instância gerencia vários condomínios com isolamento de dados por condomínio.
- **Perfis de usuário (6):** síndico, administradora/gestor, morador proprietário, inquilino, porteiro/zelador, conselho fiscal.
- **Módulos prioritários da 1ª versão (7):** cadastro, financeiro, reservas de áreas comuns, comunicação/avisos, ocorrências/manutenção, assembleias/votações, portaria/acessos.
- **Fora da 1ª versão (adiado):** documentos.
- **Primeira capacidade a detalhar a fundo:** **Cadastros**.

## Capabilities

### New Capabilities
- `cadastro` *(em detalhamento — Rodada 2)*: condomínios, unidades (blocos/torres) e pessoas (proprietários, inquilinos, moradores) com isolamento multi-tenant.
- `financeiro`: taxas, cobranças/boletos, pagamentos, inadimplência, rateio, prestação de contas.
- `reservas-areas-comuns`: reserva de áreas comuns com regras e conflitos.
- `comunicacao`: avisos/mural e notificações.
- `ocorrencias-manutencao`: chamados/ocorrências e acompanhamento.
- `assembleias-votacoes`: convocação, pautas e votação.
- `portaria-acessos`: visitantes, prestadores, encomendas e registros de acesso.
- `acesso-e-perfis` *(transversal)*: autenticação e autorização por perfil (os 6 perfis acima).

### Deferred (fora da 1ª versão)
- `documentos`: atas, regimento, contratos e arquivos do condomínio.

### Modified Capabilities
- Nenhuma (projeto novo, ainda sem specs em `openspec/specs/`).

## Impact

- Novo projeto backend (`condominio-legal-api`). Sem código legado afetado.
- O isolamento multi-tenant e o modelo de perfis são transversais e afetam todas as capacidades.

## Brainstorm log

- **Rodada 1 (escopo)** — respondida pelo board em 2026-06-04. Decisões acima.
- **Rodada 2 (Cadastros)** — respondida pelo board em 2026-06-04. Decisões:
  - Tipos de unidade: `apartamento`, `casa`, `comercial`, `garagem`, `deposito`.
  - Identificação única da unidade: **bloco/torre + número** (único no condomínio).
  - Vínculos pessoa↔unidade: `proprietario`, `inquilino`, `morador`, `responsavel_financeiro`, `imobiliaria`.
  - Uma pessoa pode estar vinculada a **várias** unidades.
  - Dados obrigatórios da pessoa: CPF, e-mail, telefone + **nome** (campo nome obrigatório **confirmado pelo Chefe** em 2026-06-04, salvo objeção do board).
  - Capacidade **`cadastro` CONSOLIDADA** em `specs/cadastro/spec.md` (5 requisitos, cenários happy/erro, `validate --strict` ok).
- **Rodada 3 (Financeiro)** — respondida pelo board em 2026-06-04. Decisões:
  - Tipos de cobrança: `taxa_mensal`, `fundo_reserva`, `extra_rateio`, `multa_juros`, `consumo`.
  - Rateio **configurável por cobrança**: `fracao_ideal` ou `igual`.
  - Devedor: **responsável financeiro** da unidade (fallback ao `proprietario` quando não definido).
  - Emissão e pagamento via **boleto E Pix** (integração bancária/PSP, com conciliação automática; pagamento por um método encerra os demais). *(Pix adicionado pelo board em 2026-06-04.)*
  - Inadimplência: marcar `em_atraso`, calcular multa+juros configuráveis, relatório de inadimplentes e notificação de cobrança.
  - Capacidade **`financeiro` CONSOLIDADA** em `specs/financeiro/spec.md` (6 requisitos, cenários happy/erro, `validate --strict` ok).
- **Rodada 4 (Comunicação/Avisos)** — respondida pelo board em 2026-06-04. Decisões:
  - Tipos: `aviso_geral`, `aviso_segmentado`, `aviso_individual`, `convocacao`.
  - Canais: `in_app`, `email`, `push`, `sms_whatsapp` (todos).
  - Podem publicar: `sindico`, `administradora`, `porteiro`, `conselho` (moradores **não** publicam).
  - Confirmação de leitura: **obrigatória em todos** os comunicados.
  - Capacidade **`comunicacao` CONSOLIDADA** em `specs/comunicacao/spec.md` (5 requisitos, `validate --strict` ok).
- **Rodada 5 (Reservas de áreas comuns)** — respondida pelo board em 2026-06-04. Decisões:
  - Granularidade, política de conflito e modo de aprovação **configuráveis por área** (`dia_inteiro`/`turno`/`horario`; `exclusiva`/`capacidade`; `automatica`/`requer_aprovacao`).
  - Regras: bloquear inadimplente, antecedência mín/máx, limite por unidade, taxa de uso (gera cobrança no Financeiro) e regras de cancelamento.
  - Capacidade **`reservas-areas-comuns` CONSOLIDADA** em `specs/reservas-areas-comuns/spec.md` (7 requisitos, `validate --strict` ok).
- **Rodada 6 (Assembleias/Votação)** — aberta na thread (próxima capacidade da sequência aprovada).

## Sequência de capacidades (aprovada pelo Chefe — validar prioridade com o board)

Uma capacidade por vez: **Cadastros (✅ consolidada) → Financeiro → Comunicação/Avisos → Reservas de áreas comuns → Assembleias/Votação → Ocorrências/Chamados**. A transversal `acesso-e-perfis` (autenticação/autorização dos 6 perfis) é especificada junto às capacidades que a exigem.

**Próximo gate (Chefe):** com o núcleo do backend especificado e validado, o Chefe abre o fan-out de implementação — UXDesigner (`DESIGN.md`) → Dev Backend (contrato da API) → Dev Frontend (UI) → QA (testes). Fora do escopo desta issue (somente backend/spec).
