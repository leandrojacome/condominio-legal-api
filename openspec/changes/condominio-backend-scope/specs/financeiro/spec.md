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

### Requirement: Emissão e pagamento via boleto e Pix
O sistema MUST permitir que uma cobrança seja emitida e paga por **boleto** (integração bancária/gateway, com nosso número e linha digitável) e/ou por **Pix** (com QR Code/copia-e-cola e identificador da transação). O sistema MUST conciliar o pagamento a partir do retorno da instituição/PSP, marcando a cobrança como `paga` na confirmação, independentemente do método. Uma mesma cobrança MUST poder ser paga por qualquer um dos métodos disponibilizados, e a confirmação por um método MUST encerrar a cobrança para os demais.

#### Scenario: Emissão de boleto com sucesso
- **GIVEN** uma cobrança `em_aberto`
- **WHEN** o gestor solicita a emissão do boleto e a integração retorna com sucesso
- **THEN** a cobrança passa a ter linha digitável e nosso número registrados

#### Scenario: Emissão de cobrança Pix com sucesso
- **GIVEN** uma cobrança `em_aberto`
- **WHEN** o gestor solicita a cobrança via Pix e a integração retorna com sucesso
- **THEN** a cobrança passa a ter QR Code/copia-e-cola e identificador da transação Pix registrados

#### Scenario: Conciliação de pagamento confirmado (boleto ou Pix)
- **GIVEN** uma cobrança com boleto e/ou Pix emitidos
- **WHEN** a integração informa a confirmação do pagamento por qualquer um dos métodos
- **THEN** a cobrança é marcada como `paga` com a data, o valor e o método de pagamento registrados

#### Scenario: Pagamento por Pix encerra o boleto da mesma cobrança
- **GIVEN** uma cobrança com boleto e Pix emitidos para o mesmo valor
- **WHEN** o pagamento é confirmado via Pix
- **THEN** a cobrança é marcada como `paga` e o boleto correspondente deixa de ser pagável (evitando pagamento em duplicidade)

#### Scenario: Falha na integração de emissão
- **GIVEN** uma cobrança `em_aberto`
- **WHEN** a integração (bancária ou de Pix) retorna erro na emissão
- **THEN** a cobrança permanece `em_aberto`, nenhum identificador de pagamento é gravado e o erro é registrado para nova tentativa

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
