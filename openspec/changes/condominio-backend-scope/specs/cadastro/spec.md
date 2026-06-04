## ADDED Requirements

### Requirement: Isolamento multi-tenant dos cadastros
O sistema MUST associar todo registro de cadastro (condomínio, unidade, pessoa e seus vínculos) a exatamente um condomínio, e DEVE impedir que um usuário acesse ou modifique registros de um condomínio ao qual não está vinculado.

#### Scenario: Leitura restrita ao próprio condomínio
- **GIVEN** um usuário vinculado ao condomínio A
- **WHEN** ele solicita a lista de unidades informando o condomínio B
- **THEN** o sistema nega o acesso (403) e não retorna nenhum dado do condomínio B

#### Scenario: Criação sempre vinculada a um condomínio
- **GIVEN** uma requisição de criação de unidade sem condomínio associado
- **WHEN** o sistema valida a requisição
- **THEN** a criação é rejeitada com erro de validação informando que o condomínio é obrigatório

### Requirement: Cadastro de condomínio
O sistema MUST permitir cadastrar, consultar e atualizar um condomínio como entidade raiz do tenant, com pelo menos nome e endereço.

#### Scenario: Cadastro de condomínio com dados mínimos
- **GIVEN** um gestor autenticado com permissão para criar condomínio
- **WHEN** ele cadastra um condomínio com nome e endereço válidos
- **THEN** o condomínio é persistido e recebe um identificador único

#### Scenario: Rejeição de condomínio sem nome
- **GIVEN** uma requisição de criação de condomínio sem nome
- **WHEN** o sistema valida a requisição
- **THEN** a criação é rejeitada com erro de validação no campo nome

### Requirement: Cadastro de unidades do condomínio
O sistema MUST permitir cadastrar unidades (apartamentos/casas) pertencentes a um condomínio, e cada unidade DEVE ser unicamente identificável dentro do seu condomínio.

#### Scenario: Cadastro de unidade vinculada ao condomínio
- **GIVEN** um condomínio existente
- **WHEN** um gestor cadastra uma unidade nesse condomínio com identificação válida
- **THEN** a unidade é persistida e fica vinculada ao condomínio

#### Scenario: Identificação de unidade duplicada no mesmo condomínio
- **GIVEN** um condomínio que já possui uma unidade com determinada identificação
- **WHEN** um gestor tenta cadastrar outra unidade com a mesma identificação no mesmo condomínio
- **THEN** o sistema rejeita o cadastro por identificação duplicada

### Requirement: Cadastro de pessoas e vínculo com unidade
O sistema MUST permitir cadastrar pessoas (moradores) e vinculá-las a uma unidade com um papel (por exemplo, proprietário ou inquilino).

#### Scenario: Vincular proprietário a uma unidade
- **GIVEN** uma unidade existente e uma pessoa cadastrada
- **WHEN** um gestor vincula a pessoa à unidade com o papel de proprietário
- **THEN** o vínculo é persistido e a pessoa passa a constar como proprietária daquela unidade

#### Scenario: Vínculo exige unidade do mesmo condomínio
- **GIVEN** uma pessoa do condomínio A
- **WHEN** um gestor tenta vinculá-la a uma unidade do condomínio B
- **THEN** o sistema rejeita o vínculo por violação de isolamento entre condomínios
