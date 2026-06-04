## ADDED Requirements

### Requirement: Registro de cobranças por tipo
O sistema MUST permitir registrar cobranças vinculadas a uma unidade de um condomínio, cada uma com um tipo dentre `taxa_mensal`, `fundo_reserva`, `extra_rateio` (despesa extra rateada), `multa_juros` (encargos) e `consumo` (medição individual, ex.: água/gás), com valor, competência (mês/ano de referência) e data de vencimento.

#### Scenario: Registrar taxa condominial mensal
- **GIVEN** uma unidade existente em um condomínio
- **WHEN** um gestor registra uma cobrança do tipo `taxa_mensal` com valor, competência e vencimento válidos
- **THEN** a cobrança é persistida, vinculada à unidade, com status inicial `em_aberto`

#### Scenario: Cobrança de consumo a partir de medição
- **GIVEN** uma unidade com leitura de consumo registrada para a competência
- **WHEN** um gestor gera uma cobrança do tipo `consumo` para essa competência
- **THEN** o valor da cobrança reflete o consumo medido

#### Scenario: Tipo de cobrança inválido
- **GIVEN** uma requisição de cobrança com tipo fora da lista permitida
- **WHEN** o sistema valida a requisição
- **THEN** a criação é rejeitada com erro de validação no campo tipo

### Requirement: Rateio configurável de despesas
O sistema MUST permitir ratear uma despesa entre as unidades do condomínio por um critério escolhido na própria cobrança: `fracao_ideal` (proporcional ao percentual/fração ideal de cada unidade) ou `igual` (mesmo valor para todas). A soma das parcelas rateadas MUST ser igual ao valor total da despesa.

#### Scenario: Rateio por fração ideal
- **GIVEN** uma despesa extra de R$ 1.000,00 e unidades com frações ideais distintas
- **WHEN** um gestor rateia a despesa pelo critério `fracao_ideal`
- **THEN** cada unidade recebe uma cobrança proporcional à sua fração ideal e a soma das parcelas é R$ 1.000,00

#### Scenario: Rateio igualitário
- **GIVEN** uma despesa de R$ 1.000,00 e 10 unidades
- **WHEN** um gestor rateia a despesa pelo critério `igual`
- **THEN** cada unidade recebe uma cobrança de R$ 100,00

### Requirement: Responsável pelo pagamento da cobrança
O sistema MUST direcionar a cobrança de uma unidade ao **responsável financeiro** definido no cadastro da unidade (vínculo `responsavel_financeiro`). Quando a unidade não tiver responsável financeiro definido, o sistema MUST direcionar a cobrança ao `proprietario` da unidade.

#### Scenario: Cobrança direcionada ao responsável financeiro
- **GIVEN** uma unidade com um responsável financeiro definido
- **WHEN** uma cobrança é gerada para essa unidade
- **THEN** o responsável financeiro consta como devedor da cobrança

#### Scenario: Fallback para o proprietário
- **GIVEN** uma unidade sem responsável financeiro definido, mas com proprietário
- **WHEN** uma cobrança é gerada para essa unidade
- **THEN** o proprietário consta como devedor da cobrança

### Requirement: Emissão de boleto via integração bancária
O sistema MUST emitir boleto para uma cobrança por meio de integração bancária/gateway, registrando os identificadores retornados (ex.: nosso número e linha digitável) e MUST conciliar o pagamento a partir do retorno da instituição, marcando a cobrança como `paga` na confirmação.

#### Scenario: Emissão de boleto com sucesso
- **GIVEN** uma cobrança `em_aberto`
- **WHEN** o gestor solicita a emissão do boleto e a integração retorna com sucesso
- **THEN** a cobrança passa a ter linha digitável e nosso número registrados

#### Scenario: Conciliação de pagamento confirmado
- **GIVEN** uma cobrança com boleto emitido
- **WHEN** a integração informa a confirmação do pagamento
- **THEN** a cobrança é marcada como `paga` com a data de pagamento registrada

#### Scenario: Falha na integração de emissão
- **GIVEN** uma cobrança `em_aberto`
- **WHEN** a integração bancária retorna erro na emissão do boleto
- **THEN** a cobrança permanece `em_aberto`, nenhuma linha digitável é gravada e o erro é registrado para nova tentativa

### Requirement: Inadimplência e cálculo de encargos
O sistema MUST marcar automaticamente como `em_atraso` toda cobrança não paga após a data de vencimento, e MUST calcular multa e juros configuráveis pelo condomínio sobre o valor em atraso.

#### Scenario: Cobrança vence sem pagamento
- **GIVEN** uma cobrança `em_aberto` com vencimento no passado e sem pagamento
- **WHEN** o sistema avalia o status da cobrança
- **THEN** a cobrança passa para `em_atraso`

#### Scenario: Cálculo de multa e juros
- **GIVEN** uma cobrança `em_atraso` e percentuais de multa e juros configurados no condomínio
- **WHEN** o sistema calcula o valor atualizado da cobrança
- **THEN** o valor devido inclui o principal acrescido da multa e dos juros proporcionais ao atraso

### Requirement: Consulta de inadimplentes e notificação de cobrança
O sistema MUST disponibilizar a consulta das unidades/pessoas em atraso de um condomínio e MUST permitir disparar uma notificação de cobrança ao responsável pela cobrança em atraso.

#### Scenario: Relatório de inadimplentes
- **GIVEN** um condomínio com cobranças `em_atraso`
- **WHEN** um gestor consulta a relação de inadimplentes
- **THEN** o sistema retorna as unidades/pessoas em atraso com os respectivos valores devidos

#### Scenario: Notificação de cobrança em atraso
- **GIVEN** uma cobrança `em_atraso`
- **WHEN** um gestor dispara a notificação de cobrança
- **THEN** o sistema registra o envio de uma notificação ao responsável pela cobrança
