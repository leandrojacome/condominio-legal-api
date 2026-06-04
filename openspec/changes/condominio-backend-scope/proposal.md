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
- **Rodada 2 (Cadastros)** — aberta na thread; detalha tipos de unidade, identificação, vínculos pessoa↔unidade e dados obrigatórios. Respostas serão convertidas em requisitos no spec delta `specs/cadastro/spec.md`.
