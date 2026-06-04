## ADDED Requirements

### Requirement: Abertura de ocorrência por tipo
O sistema MUST permitir que qualquer morador (`proprietario`, `inquilino`, `morador`) e a gestão/portaria (`sindico`, `administradora`, `porteiro`) abram ocorrências em um condomínio, cada uma com um tipo dentre `manutencao`, `reclamacao`, `sugestao`, `seguranca` e `achados`, com título e descrição.

#### Scenario: Morador abre ocorrência de manutenção
- **GIVEN** um morador autenticado em um condomínio
- **WHEN** ele abre uma ocorrência do tipo `manutencao` com título e descrição válidos
- **THEN** a ocorrência é persistida, vinculada ao condomínio e ao autor, no status inicial do fluxo do condomínio

#### Scenario: Tipo de ocorrência inválido
- **GIVEN** uma requisição de abertura com tipo fora da lista permitida
- **WHEN** o sistema valida a requisição
- **THEN** a abertura é rejeitada com erro de validação no campo tipo

### Requirement: Fluxo de status configurável pelo condomínio
O sistema MUST permitir que cada condomínio configure o conjunto de status do fluxo de ocorrências e suas transições válidas, e MUST recusar transições não permitidas pela configuração.

#### Scenario: Transição válida de status
- **GIVEN** um condomínio cujo fluxo permite `aberta → em_andamento`
- **WHEN** o responsável move uma ocorrência `aberta` para `em_andamento`
- **THEN** a ocorrência passa para `em_andamento` e a mudança é registrada

#### Scenario: Transição inválida é recusada
- **GIVEN** um condomínio cujo fluxo não permite `aberta → fechada` diretamente
- **WHEN** alguém tenta mover uma ocorrência `aberta` para `fechada`
- **THEN** o sistema recusa a transição por violar o fluxo configurado

### Requirement: Atribuição a responsável e prioridade/SLA
O sistema MUST permitir atribuir uma ocorrência a um responsável (ex.: zelador, prestador ou gestor) e definir prioridade com um prazo de atendimento (SLA), MUST sinalizar quando o SLA é estourado.

#### Scenario: Atribuir responsável e prioridade
- **GIVEN** uma ocorrência aberta
- **WHEN** o gestor a atribui a um responsável com prioridade `alta` e SLA de 24h
- **THEN** a ocorrência registra responsável, prioridade e prazo de atendimento

#### Scenario: SLA estourado é sinalizado
- **GIVEN** uma ocorrência com SLA de 24h ainda não resolvida
- **WHEN** o prazo de 24h é ultrapassado sem resolução
- **THEN** a ocorrência é sinalizada como SLA estourado

### Requirement: Anexos e histórico de comentários
O sistema MUST permitir anexar arquivos (ex.: fotos) a uma ocorrência e MUST manter um histórico de comentários e mudanças de status na ocorrência.

#### Scenario: Anexar foto à ocorrência
- **GIVEN** uma ocorrência existente
- **WHEN** o autor anexa uma foto como evidência
- **THEN** o anexo fica associado à ocorrência e disponível para consulta

#### Scenario: Registro de comentário no histórico
- **GIVEN** uma ocorrência em andamento
- **WHEN** o responsável adiciona um comentário sobre o andamento
- **THEN** o comentário é registrado no histórico com autor e data

### Requirement: Notificação do autor a cada mudança
O sistema MUST notificar o autor da ocorrência a cada mudança de status ou novo comentário, por meio da capacidade de Comunicação.

#### Scenario: Autor notificado em mudança de status
- **GIVEN** uma ocorrência aberta por um morador
- **WHEN** o status da ocorrência muda
- **THEN** o sistema envia uma notificação ao autor informando a atualização

### Requirement: Avaliação ao encerrar a ocorrência
O sistema MUST permitir que o autor avalie o atendimento quando a ocorrência é encerrada, registrando a avaliação vinculada à ocorrência.

#### Scenario: Autor avalia atendimento encerrado
- **GIVEN** uma ocorrência movida para um status de encerramento
- **WHEN** o autor registra uma avaliação do atendimento
- **THEN** a avaliação é persistida e vinculada à ocorrência

#### Scenario: Avaliação só após o encerramento
- **GIVEN** uma ocorrência ainda em andamento (não encerrada)
- **WHEN** o autor tenta avaliar o atendimento
- **THEN** o sistema recusa a avaliação por a ocorrência não estar encerrada
