## Why

O board (Leandro) quer iniciar a especificação do **backend** de um software de gestão de condomínios. Antes de implementar, precisamos transformar a intenção do produto em requisitos claros, testáveis e sem ambiguidade, capturados em OpenSpec. Este change abre o escopo e conduz o brainstorm, atividade por atividade, com o board.

Escopo desta fase = **somente backend** (API / domínio / dados). Frontend e testes serão delegados depois pelo Chefe.

## What Changes

Esta proposta ainda está em **brainstorm aberto**. À medida que o board responde cada rodada de perguntas, transformamos as respostas em capacidades (`capabilities`), requisitos normativos (`The system SHALL …`) e cenários testáveis (GIVEN/WHEN/THEN).

Capacidades candidatas levantadas para o backend de condomínio (a serem confirmadas/priorizadas pelo board):

- `cadastro-condominio`: condomínios, unidades (apartamentos/casas), blocos/torres e seus dados.
- `cadastro-pessoas`: moradores/condôminos, proprietários, inquilinos, dependentes e vínculo com unidades.
- `acesso-e-perfis`: autenticação, perfis (síndico, administradora, morador, inquilino, porteiro, conselho) e autorização por perfil.
- `financeiro`: taxas condominiais, cobranças/boletos, pagamentos, inadimplência, rateio de despesas, prestação de contas.
- `reservas-areas-comuns`: reserva de salão de festas, churrasqueira e demais áreas, com regras e conflitos.
- `comunicacao`: avisos/mural, notificações aos moradores.
- `ocorrencias-manutencao`: chamados/ocorrências, manutenção, acompanhamento de status.
- `assembleias-votacoes`: convocação de assembleias, pautas e votações.
- `portaria-acessos`: controle de visitantes, prestadores, encomendas e registros de acesso.
- `documentos`: armazenamento de documentos do condomínio (atas, regimento, contratos).

## Capabilities

### New Capabilities
- A definir após a 1ª rodada de brainstorm com o board (lista candidata acima).

### Modified Capabilities
- Nenhuma (projeto novo, ainda sem specs em `openspec/specs/`).

## Impact

- Novo projeto backend (`condominio-legal-api`). Sem código legado afetado.
- Define a base de domínio/dados/API para todas as fases seguintes.

## Open Questions (1ª rodada — enviada ao board via interação na thread)

1. Quais módulos/capacidades são prioritários para a 1ª versão do backend?
2. O backend será multi-condomínio (SaaS multi-tenant) ou um condomínio por instância?
3. Quais perfis de usuário o sistema precisa suportar?
4. Por qual capacidade devemos começar o detalhamento (1ª atividade a especificar a fundo)?

Decisões e respostas serão registradas aqui e convertidas em spec deltas em `specs/<capability>/spec.md`.
