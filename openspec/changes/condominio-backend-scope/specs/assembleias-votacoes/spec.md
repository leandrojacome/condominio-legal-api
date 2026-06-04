## ADDED Requirements

### Requirement: Convocação de assembleia híbrida com pauta
O sistema MUST permitir convocar uma assembleia de um condomínio na modalidade híbrida (participação presencial + votação online), com data/hora, local e uma pauta contendo um ou mais itens de votação.

#### Scenario: Convocar assembleia com múltiplas pautas
- **GIVEN** um síndico/gestor autorizado
- **WHEN** ele convoca uma assembleia híbrida com data, local e 3 itens de pauta
- **THEN** a assembleia é persistida com os 3 itens de pauta e status `convocada`

#### Scenario: Convocação exige ao menos um item de pauta
- **GIVEN** uma requisição de convocação sem nenhum item de pauta
- **WHEN** o sistema valida a requisição
- **THEN** a convocação é rejeitada com erro de validação indicando pauta obrigatória

### Requirement: Critério de voto configurável por pauta
O sistema MUST permitir configurar, por assembleia ou por item de pauta, o critério de contagem de votos: `por_unidade` (1 voto por unidade) ou `por_fracao` (peso proporcional à fração ideal da unidade).

#### Scenario: Contagem 1 voto por unidade
- **GIVEN** um item de pauta configurado como `por_unidade`
- **WHEN** o sistema apura os votos
- **THEN** cada unidade votante contribui com exatamente 1 voto

#### Scenario: Contagem por fração ideal
- **GIVEN** um item de pauta configurado como `por_fracao`
- **WHEN** o sistema apura os votos
- **THEN** o voto de cada unidade é ponderado pela sua fração ideal

### Requirement: Quórum mínimo da votação
O sistema MUST validar o quórum mínimo configurado para a assembleia/pauta e MUST considerar a votação válida apenas quando o quórum for atingido.

#### Scenario: Quórum atingido valida a votação
- **GIVEN** um item de pauta com quórum mínimo configurado e participação suficiente
- **WHEN** a votação é encerrada
- **THEN** o resultado é apurado e considerado válido

#### Scenario: Quórum não atingido invalida a votação
- **GIVEN** um item de pauta com quórum mínimo não atingido
- **WHEN** a votação é encerrada
- **THEN** o sistema registra a votação como sem quórum e não homologa o resultado

### Requirement: Elegibilidade do votante e procuração
O sistema MUST impedir o voto de unidades inadimplentes (com cobranças `em_atraso`) e MUST permitir que um votante represente outra unidade por procuração registrada, computando o voto da unidade representada.

#### Scenario: Inadimplente não vota
- **GIVEN** uma unidade com cobrança `em_atraso`
- **WHEN** o representante dessa unidade tenta votar
- **THEN** o sistema recusa o voto por inadimplência

#### Scenario: Voto por procuração
- **GIVEN** um morador com procuração registrada para representar a unidade 502
- **WHEN** ele vota em nome da unidade 502
- **THEN** o voto é computado para a unidade 502

#### Scenario: Voto em duplicidade pela mesma unidade é rejeitado
- **GIVEN** uma unidade que já registrou voto em um item de pauta
- **WHEN** um novo voto é submetido para a mesma unidade no mesmo item
- **THEN** o sistema rejeita o voto duplicado

### Requirement: Voto secreto opcional por pauta
O sistema MUST permitir marcar um item de pauta como voto secreto, ocultando a associação entre o voto e a identidade do votante na apuração, preservando apenas a contagem.

#### Scenario: Pauta com voto secreto
- **GIVEN** um item de pauta marcado como secreto
- **WHEN** os votos são apurados
- **THEN** o resultado apresenta apenas a contagem por opção, sem expor quem votou em quê

#### Scenario: Pauta aberta mantém rastreabilidade
- **GIVEN** um item de pauta não secreto
- **WHEN** os votos são apurados
- **THEN** o resultado permite identificar como cada unidade votou

### Requirement: Apuração, ata e divulgação do resultado
O sistema MUST apurar automaticamente o resultado de cada item de pauta, MUST gerar a ata/registro oficial da assembleia (pauta, votos válidos e decisão), MUST permitir notificar os moradores do resultado (integração com Comunicação) e MUST manter histórico auditável dos votos.

#### Scenario: Apuração automática por pauta
- **GIVEN** uma assembleia com votação encerrada e quórum atingido
- **WHEN** o sistema apura os resultados
- **THEN** cada item de pauta recebe seu resultado (aprovado/reprovado) conforme a contagem

#### Scenario: Geração da ata
- **GIVEN** uma assembleia apurada
- **WHEN** o gestor gera a ata
- **THEN** o sistema produz um registro oficial com a pauta, os resultados e as decisões

#### Scenario: Notificação do resultado aos moradores
- **GIVEN** uma assembleia apurada
- **WHEN** o gestor dispara a divulgação do resultado
- **THEN** um comunicado com o resultado é enviado aos moradores via Comunicação

#### Scenario: Auditoria dos votos
- **GIVEN** uma assembleia encerrada
- **WHEN** um auditor consulta o histórico de votação
- **THEN** o sistema retorna o registro auditável (respeitando o sigilo das pautas secretas) com data/hora dos votos
