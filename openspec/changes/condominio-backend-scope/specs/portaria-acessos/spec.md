## ADDED Requirements

### Requirement: Registro de acesso por tipo
O sistema MUST permitir registrar acessos na portaria de um condomínio por tipo dentre `visitante`, `prestador`, `entrega` e `veiculo`, guardando identificação (nome e documento), unidade de destino, horário de entrada e de saída e quem autorizou.

#### Scenario: Registrar entrada de visitante
- **GIVEN** um porteiro autenticado em um condomínio
- **WHEN** ele registra a entrada de um `visitante` com identificação, unidade de destino e autorizador
- **THEN** o registro de acesso é persistido com horário de entrada e status "no condomínio"

#### Scenario: Registrar saída
- **GIVEN** um registro de acesso com entrada e sem saída
- **WHEN** o porteiro registra a saída
- **THEN** o horário de saída é gravado e o acesso é encerrado

#### Scenario: Tipo de acesso inválido
- **GIVEN** uma requisição de registro com tipo fora da lista permitida
- **WHEN** o sistema valida a requisição
- **THEN** o registro é rejeitado com erro de validação no campo tipo

### Requirement: Autorização de acesso por pré-autorização e por confirmação
O sistema MUST suportar dois fluxos de autorização de visitantes/prestadores: pré-autorização registrada pelo morador antes da chegada e confirmação do morador no momento da chegada solicitada pela portaria. O acesso NÃO MUST ser liberado sem uma autorização válida por um dos fluxos.

#### Scenario: Acesso com pré-autorização do morador
- **GIVEN** um morador que pré-autorizou um visitante para uma data
- **WHEN** o visitante chega e o porteiro consulta a pré-autorização válida
- **THEN** o acesso é liberado e o registro referencia a pré-autorização

#### Scenario: Acesso por confirmação na chegada
- **GIVEN** um visitante sem pré-autorização
- **WHEN** o porteiro solicita confirmação ao morador e o morador confirma
- **THEN** o acesso é liberado e o registro referencia a confirmação do morador

#### Scenario: Acesso negado sem autorização
- **GIVEN** um visitante sem pré-autorização e cujo morador recusa ou não confirma
- **WHEN** o porteiro tenta liberar o acesso
- **THEN** o sistema não libera o acesso e registra a tentativa como negada

### Requirement: Gestão de encomendas
O sistema MUST permitir registrar o recebimento de encomendas na portaria (data, unidade de destino, remetente e foto/etiqueta), MUST notificar o morador da unidade de destino (via Comunicação) e MUST registrar a retirada com identificação de quem retirou e a data/hora.

#### Scenario: Registrar e notificar encomenda recebida
- **GIVEN** um porteiro recebendo uma encomenda
- **WHEN** ele registra a encomenda com unidade de destino e foto
- **THEN** a encomenda é persistida e o morador da unidade é notificado

#### Scenario: Registrar retirada da encomenda
- **GIVEN** uma encomenda registrada e ainda não retirada
- **WHEN** alguém retira a encomenda e o porteiro registra a retirada
- **THEN** o sistema grava quem retirou e a data/hora, e a encomenda passa a "retirada"

### Requirement: Histórico auditável de acessos
O sistema MUST disponibilizar a consulta do histórico de acessos e encomendas de um condomínio, filtrável por unidade e por período, restrito ao condomínio correspondente.

#### Scenario: Consultar histórico de acessos por unidade e período
- **GIVEN** um condomínio com registros de acesso
- **WHEN** um gestor consulta o histórico filtrando por uma unidade e um período
- **THEN** o sistema retorna os acessos e encomendas daquela unidade no período

#### Scenario: Histórico não vaza para outro condomínio
- **GIVEN** registros de acesso do condomínio A
- **WHEN** um usuário do condomínio B consulta o histórico
- **THEN** os registros do condomínio A não são retornados
