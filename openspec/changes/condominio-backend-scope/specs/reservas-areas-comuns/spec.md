## ADDED Requirements

### Requirement: Configuração de área comum reservável
O sistema MUST permitir cadastrar áreas comuns reserváveis de um condomínio, cada uma com configuração própria de: granularidade temporal (`dia_inteiro`, `turno` ou `horario`), política de conflito (`exclusiva` ou `capacidade` com número de vagas), modo de aprovação (`automatica` ou `requer_aprovacao`) e parâmetros de regras (antecedência mínima/máxima, limite por unidade, taxa de uso e prazo de cancelamento).

#### Scenario: Cadastrar área com configuração própria
- **GIVEN** um gestor autenticado em um condomínio
- **WHEN** ele cadastra a área "Salão de Festas" com granularidade `dia_inteiro`, política `exclusiva` e modo `requer_aprovacao`
- **THEN** a área é persistida com essa configuração e fica disponível para reserva

#### Scenario: Cada área mantém sua própria granularidade
- **GIVEN** um condomínio com "Salão" (`dia_inteiro`) e "Quadra" (`horario`)
- **WHEN** as áreas são consultadas
- **THEN** cada uma expõe a sua granularidade de reserva configurada

### Requirement: Disponibilidade e política de conflito
O sistema MUST verificar a disponibilidade do período solicitado conforme a granularidade da área e MUST aplicar a política de conflito: em área `exclusiva`, recusar período já reservado; em área com `capacidade`, aceitar reservas simultâneas até o limite de vagas.

#### Scenario: Reserva exclusiva em conflito é recusada
- **GIVEN** uma área `exclusiva` já reservada para um período
- **WHEN** outra unidade tenta reservar o mesmo período
- **THEN** o sistema recusa a reserva por indisponibilidade

#### Scenario: Reserva por capacidade dentro do limite
- **GIVEN** uma área com `capacidade` de 10 vagas e 9 reservas no período
- **WHEN** uma nova reserva é solicitada para o mesmo período
- **THEN** a reserva é aceita (10ª vaga)

#### Scenario: Reserva por capacidade esgotada
- **GIVEN** uma área com `capacidade` de 10 vagas e 10 reservas no período
- **WHEN** uma nova reserva é solicitada para o mesmo período
- **THEN** o sistema recusa a reserva por capacidade esgotada

### Requirement: Modo de aprovação da reserva
O sistema MUST confirmar imediatamente a reserva quando a área é `automatica` e o período está disponível, e MUST deixar a reserva como `pendente` aguardando decisão do síndico/gestor quando a área `requer_aprovacao`, registrando a aprovação ou recusa.

#### Scenario: Confirmação automática
- **GIVEN** uma área `automatica` com o período disponível
- **WHEN** uma unidade solicita a reserva
- **THEN** a reserva é criada com status `confirmada`

#### Scenario: Reserva pendente de aprovação
- **GIVEN** uma área `requer_aprovacao`
- **WHEN** uma unidade solicita a reserva
- **THEN** a reserva é criada com status `pendente` e aguarda decisão do gestor

#### Scenario: Aprovação pelo gestor
- **GIVEN** uma reserva `pendente`
- **WHEN** o síndico/gestor aprova a reserva
- **THEN** a reserva passa a `confirmada`

### Requirement: Bloqueio de unidade inadimplente
O sistema MUST impedir que uma unidade com cobranças `em_atraso` realize reservas, conforme o status de inadimplência do Financeiro.

#### Scenario: Inadimplente não reserva
- **GIVEN** uma unidade com cobrança `em_atraso`
- **WHEN** ela tenta solicitar uma reserva
- **THEN** o sistema recusa a reserva informando inadimplência

#### Scenario: Unidade adimplente reserva normalmente
- **GIVEN** uma unidade sem cobranças em atraso
- **WHEN** ela solicita uma reserva em período disponível
- **THEN** a reserva é aceita conforme o modo de aprovação da área

### Requirement: Antecedência e limite por unidade
O sistema MUST validar a antecedência mínima e máxima configuradas na área e MUST aplicar o limite de reservas por unidade no período configurado.

#### Scenario: Antecedência mínima não respeitada
- **GIVEN** uma área que exige antecedência mínima de 2 dias
- **WHEN** uma unidade tenta reservar para o dia seguinte
- **THEN** o sistema recusa a reserva por antecedência insuficiente

#### Scenario: Limite de reservas por unidade atingido
- **GIVEN** uma área com limite de 1 reserva por unidade no mês e a unidade já com 1 reserva no mês
- **WHEN** a unidade tenta uma segunda reserva no mesmo mês
- **THEN** o sistema recusa a reserva por limite atingido

### Requirement: Taxa de uso integrada ao Financeiro
O sistema MUST, quando a área possui taxa de uso, gerar uma cobrança no Financeiro vinculada à reserva no momento da confirmação.

#### Scenario: Reserva com taxa gera cobrança
- **GIVEN** uma área com taxa de uso configurada
- **WHEN** uma reserva nessa área é confirmada
- **THEN** uma cobrança correspondente é criada no Financeiro, vinculada à reserva e à unidade

### Requirement: Cancelamento de reserva
O sistema MUST permitir cancelar uma reserva e MUST aplicar a regra de prazo de cancelamento da área: cancelamento dentro do prazo não gera penalidade; fora do prazo aplica a penalidade configurada (ex.: retenção da taxa).

#### Scenario: Cancelamento dentro do prazo
- **GIVEN** uma reserva confirmada e o cancelamento solicitado dentro do prazo sem penalidade
- **WHEN** a unidade cancela a reserva
- **THEN** a reserva é cancelada e nenhuma penalidade é aplicada; eventual taxa é estornada/cancelada

#### Scenario: Cancelamento fora do prazo
- **GIVEN** uma reserva confirmada com taxa e o cancelamento solicitado fora do prazo
- **WHEN** a unidade cancela a reserva
- **THEN** a reserva é cancelada e a penalidade configurada é aplicada (ex.: a taxa é retida)
