## ADDED Requirements

### Requirement: Isolamento multi-tenant dos cadastros
O sistema MUST associar todo registro de cadastro (condomínio, unidade, pessoa e seus vínculos) a exatamente um condomínio, e MUST impedir que um usuário acesse ou modifique registros de um condomínio ao qual não está vinculado.

#### Scenario: Leitura restrita ao próprio condomínio
- **GIVEN** um usuário vinculado ao condomínio A
- **WHEN** ele solicita a lista de unidades informando o condomínio B
- **THEN** o sistema nega o acesso (403) e não retorna nenhum dado do condomínio B

#### Scenario: Criação sempre vinculada a um condomínio
- **GIVEN** uma requisição de criação de unidade sem condomínio associado
- **WHEN** o sistema valida a requisição
- **THEN** a criação é rejeitada com erro de validação informando que o condomínio é obrigatório

### Requirement: Cadastro de condomínio
O sistema MUST permitir cadastrar, consultar e atualizar um condomínio como entidade raiz do tenant, com pelo menos nome e endereço. O sistema MUST permitir que um condomínio organize suas unidades em blocos/torres opcionais.

#### Scenario: Cadastro de condomínio com dados mínimos
- **GIVEN** um gestor autenticado com permissão para criar condomínio
- **WHEN** ele cadastra um condomínio com nome e endereço válidos
- **THEN** o condomínio é persistido e recebe um identificador único

#### Scenario: Rejeição de condomínio sem nome
- **GIVEN** uma requisição de criação de condomínio sem nome
- **WHEN** o sistema valida a requisição
- **THEN** a criação é rejeitada com erro de validação no campo nome

### Requirement: Cadastro de unidades do condomínio
O sistema MUST permitir cadastrar unidades pertencentes a um condomínio, cada uma com um tipo dentre `apartamento`, `casa`, `comercial`, `garagem` (vaga autônoma) ou `deposito` (box). A unidade MUST ser identificada por bloco/torre + número, e essa combinação MUST ser única dentro do condomínio. Quando o condomínio não usa blocos, o bloco pode ser vazio e o número MUST ser único no condomínio.

#### Scenario: Cadastro de unidade com bloco e número
- **GIVEN** um condomínio existente
- **WHEN** um gestor cadastra uma unidade do tipo `apartamento` no Bloco B, número 302
- **THEN** a unidade é persistida, vinculada ao condomínio, com tipo, bloco e número

#### Scenario: Identificação de unidade duplicada no mesmo condomínio
- **GIVEN** um condomínio que já possui a unidade Bloco B / número 302
- **WHEN** um gestor tenta cadastrar outra unidade Bloco B / número 302 no mesmo condomínio
- **THEN** o sistema rejeita o cadastro por identificação (bloco + número) duplicada

#### Scenario: Tipo de unidade inválido
- **GIVEN** uma requisição de criação de unidade com tipo fora da lista permitida
- **WHEN** o sistema valida a requisição
- **THEN** a criação é rejeitada com erro de validação no campo tipo

### Requirement: Cadastro de pessoas
O sistema MUST permitir cadastrar pessoas com nome, CPF, e-mail e telefone obrigatórios. O CPF MUST ser único por condomínio, de forma que a mesma pessoa não seja cadastrada em duplicidade no mesmo condomínio.

#### Scenario: Cadastro de pessoa com dados obrigatórios
- **GIVEN** um gestor autenticado
- **WHEN** ele cadastra uma pessoa com nome, CPF, e-mail e telefone válidos
- **THEN** a pessoa é persistida e recebe um identificador único

#### Scenario: Rejeição por dado obrigatório ausente
- **GIVEN** uma requisição de cadastro de pessoa sem CPF (ou sem e-mail, ou sem telefone)
- **WHEN** o sistema valida a requisição
- **THEN** a criação é rejeitada com erro de validação indicando o campo obrigatório faltante

#### Scenario: CPF duplicado no mesmo condomínio
- **GIVEN** um condomínio que já possui uma pessoa com determinado CPF
- **WHEN** um gestor tenta cadastrar outra pessoa com o mesmo CPF nesse condomínio
- **THEN** o sistema rejeita o cadastro por CPF duplicado

### Requirement: Vínculo entre pessoa e unidade
O sistema MUST permitir vincular uma pessoa a uma unidade com um papel dentre `proprietario`, `inquilino`, `morador` (dependente), `responsavel_financeiro` ou `imobiliaria`. Uma mesma pessoa MUST poder estar vinculada a várias unidades, e uma unidade MUST poder ter vários vínculos. O vínculo MUST exigir que pessoa e unidade pertençam ao mesmo condomínio.

#### Scenario: Vincular proprietário a uma unidade
- **GIVEN** uma unidade existente e uma pessoa cadastrada no mesmo condomínio
- **WHEN** um gestor vincula a pessoa à unidade com o papel `proprietario`
- **THEN** o vínculo é persistido e a pessoa passa a constar como proprietária daquela unidade

#### Scenario: Pessoa vinculada a múltiplas unidades
- **GIVEN** uma pessoa já vinculada à unidade 101 como `proprietario`
- **WHEN** um gestor vincula a mesma pessoa à unidade 202 como `proprietario`
- **THEN** ambos os vínculos coexistem para a mesma pessoa

#### Scenario: Papel de vínculo inválido
- **GIVEN** uma requisição de vínculo com papel fora da lista permitida
- **WHEN** o sistema valida a requisição
- **THEN** o vínculo é rejeitado com erro de validação no campo papel

#### Scenario: Vínculo exige unidade do mesmo condomínio
- **GIVEN** uma pessoa do condomínio A
- **WHEN** um gestor tenta vinculá-la a uma unidade do condomínio B
- **THEN** o sistema rejeita o vínculo por violação de isolamento entre condomínios
