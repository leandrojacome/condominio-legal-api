## ADDED Requirements

### Requirement: Publicação de comunicados por tipo
O sistema MUST permitir publicar comunicados vinculados a um condomínio, cada um com um tipo dentre `aviso_geral` (todo o condomínio), `aviso_segmentado` (um bloco/torre, andar ou grupo de unidades), `aviso_individual` (uma unidade ou pessoa específica) e `convocacao` (documento oficial, ex.: assembleia). Para `aviso_segmentado` e `aviso_individual`, o comunicado MUST registrar o público-alvo correspondente.

#### Scenario: Publicar aviso geral
- **GIVEN** um usuário autorizado a publicar comunicados em um condomínio
- **WHEN** ele publica um comunicado do tipo `aviso_geral` com título e conteúdo válidos
- **THEN** o comunicado é persistido, vinculado ao condomínio, e tem como público-alvo todas as unidades do condomínio

#### Scenario: Publicar aviso segmentado para um bloco
- **GIVEN** um usuário autorizado e um condomínio com blocos
- **WHEN** ele publica um `aviso_segmentado` direcionado ao Bloco B
- **THEN** o comunicado é persistido com público-alvo restrito às unidades do Bloco B

#### Scenario: Público-alvo obrigatório em aviso segmentado
- **GIVEN** uma requisição de `aviso_segmentado` sem público-alvo definido
- **WHEN** o sistema valida a requisição
- **THEN** a publicação é rejeitada com erro de validação indicando que o público-alvo é obrigatório

### Requirement: Autorização para publicar comunicados
O sistema MUST permitir publicar comunicados apenas para os perfis `sindico`, `administradora`, `porteiro` e `conselho`. Usuários com perfil de morador (`proprietario`, `inquilino`, `morador`) NÃO MUST poder publicar comunicados.

#### Scenario: Morador não pode publicar
- **GIVEN** um usuário com perfil `inquilino`
- **WHEN** ele tenta publicar um comunicado
- **THEN** o sistema nega a ação (403) e nenhum comunicado é criado

#### Scenario: Porteiro pode publicar aviso individual
- **GIVEN** um usuário com perfil `porteiro`
- **WHEN** ele publica um `aviso_individual` (ex.: encomenda na portaria) para uma unidade
- **THEN** o comunicado é criado e direcionado à unidade

### Requirement: Entrega multicanal de comunicados
O sistema MUST entregar cada comunicado aos seus destinatários pelos canais `in_app` (mural/feed), `email`, `push` e `sms_whatsapp`, registrando o status de envio por canal e por destinatário. A falha de entrega em um canal NÃO MUST impedir a entrega pelos demais canais.

#### Scenario: Entrega por todos os canais
- **GIVEN** um comunicado publicado para uma unidade cujo morador tem e-mail, telefone e dispositivo registrados
- **WHEN** o sistema processa a entrega
- **THEN** o comunicado é registrado como enviado por `in_app`, `email`, `push` e `sms_whatsapp`

#### Scenario: Falha em um canal não bloqueia os outros
- **GIVEN** um comunicado em entrega e o provedor de SMS/WhatsApp indisponível
- **WHEN** o sistema processa a entrega
- **THEN** os canais `in_app`, `email` e `push` são entregues e o canal `sms_whatsapp` fica com status de falha para nova tentativa

### Requirement: Confirmação de leitura dos comunicados
O sistema MUST registrar a confirmação de leitura/ciência de cada destinatário para todos os comunicados e MUST permitir consultar quem leu e quem ainda não leu um comunicado.

#### Scenario: Registrar ciência do destinatário
- **GIVEN** um comunicado entregue a um destinatário
- **WHEN** o destinatário confirma a leitura/ciência
- **THEN** o sistema registra a confirmação com data e identidade do destinatário

#### Scenario: Consultar pendências de leitura
- **GIVEN** um comunicado com vários destinatários, parte deles ainda sem confirmar
- **WHEN** o autor (ou gestor) consulta o status de leitura
- **THEN** o sistema retorna a relação de quem já confirmou e de quem ainda está pendente

### Requirement: Isolamento de comunicados por condomínio
O sistema MUST restringir os destinatários e a visibilidade de um comunicado ao condomínio ao qual ele pertence, impedindo entrega ou consulta por usuários de outro condomínio.

#### Scenario: Comunicado não vaza para outro condomínio
- **GIVEN** um comunicado publicado no condomínio A
- **WHEN** um usuário do condomínio B consulta seus comunicados
- **THEN** o comunicado do condomínio A não é retornado para o usuário do condomínio B
