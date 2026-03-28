# Plano do Projeto: Pokedex de Busca por Criterios

## 1. Resumo

Este projeto sera uma aplicacao front-end em JavaScript puro, com interface moderna em ingles, focada em busca por criterios combinados sobre Pokemon e suas formas. O objetivo nao e listar todos os Pokemon como uma pokedex tradicional, e sim permitir buscas dirigidas por atributos como abilities, types, moves e base stats.

Exemplo de busca alvo:

- ability = `intimidate`
- type = `dark`
- move = `parting-shot`
- speed >= `60`

O sistema deve retornar todas as formas de Pokemon que atendam aos criterios configurados, mostrando cada forma em um card separado.

## 2. Decisoes Ja Confirmadas

- Stack principal: `HTML + CSS + JavaScript` puro, sem framework.
- Interface: em `ingles`.
- Estilo visual: `moderno`.
- Execucao inicial: `local`, sem deploy agora.
- Entrada de busca: acionada por botao `Search`.
- Comportamento padrao: filtros em modo `AND`.
- Comportamento avancado: permitir `OR` em grupos desejados.
- Formas separadas contam como Pokemon diferentes.
- Busca por move: considerar qualquer Pokemon que possa aprender o move por qualquer metodo.
- Resultados devem mostrar: `name`, `sprite`, `types`, `abilities`.
- A pagina inicial nao deve listar Pokemon por padrao.
- Preferencia tecnica escolhida: `frontend 100% browser-only`, consumindo a PokeAPI diretamente no navegador.

## 3. Objetivo do Produto

Entregar uma ferramenta de descoberta de Pokemon baseada em criterios compostos, com experiencia mais parecida com um buscador filtravel do que com uma pokedex classica. O valor principal do projeto esta em responder perguntas do tipo:

- "Which Dark-type Pokemon can learn Parting Shot?"
- "Which forms have Intimidate and base Speed >= 60?"
- "Which Pokemon match this exact mix of type, move and stat rules?"

## 4. Escopo Funcional da Primeira Versao

### 4.1 Filtros suportados

O produto deve suportar filtros para:

- `Abilities`
- `Types`
- `Moves`
- `Base stats`: `hp`, `attack`, `defense`, `special-attack`, `special-defense`, `speed`

### 4.2 Regras logicas

Regra principal da busca:

- Entre grupos diferentes, a combinacao sera `AND`.
- Dentro de cada grupo, o usuario podera escolher `AND` ou `OR`.

Exemplos:

- `(type = dark OR ghost) AND (move = parting-shot) AND (speed >= 60)`
- `(ability = intimidate OR moxie) AND (type = dark) AND (attack >= 100 OR speed >= 80)`

### 4.3 Regras por grupo

- `Types`
  - `AND`: o Pokemon precisa possuir todos os tipos selecionados.
  - `OR`: o Pokemon precisa possuir pelo menos um dos tipos selecionados.
- `Abilities`
  - `AND`: o Pokemon precisa possuir todas as abilities selecionadas.
  - `OR`: o Pokemon precisa possuir pelo menos uma das abilities selecionadas.
- `Moves`
  - `AND`: o Pokemon precisa poder aprender todos os moves selecionados.
  - `OR`: o Pokemon precisa poder aprender pelo menos um dos moves selecionados.
- `Stats`
  - Cada regra numerica sera uma clausula.
  - Cada clausula tera pelo menos: `stat`, `operator`, `value`.
  - Para o caso atual, o operador minimo necessario e `>=`.
  - Para deixar a arquitetura pronta para evolucao, o plano considera suporte futuro a `<=` e `=`.
  - O grupo de stats tambem podera operar em `AND` ou `OR`.

### 4.4 Regras de resultado

- Cada forma deve aparecer em um card proprio.
- Nao mostrar listagem completa ao carregar a pagina.
- Exigir pelo menos um criterio antes de executar a busca.
- Ordenacao inicial sugerida:
  - primeiro por `name`
  - depois por `id`

## 5. Experiencia do Usuario

### 5.1 Tela inicial

A home sera uma tela de busca, nao uma listagem de pokedex. A estrutura sugerida:

1. Hero curto com titulo e explicacao do produto.
2. Painel principal de filtros.
3. Botao `Search`.
4. Area de status da busca.
5. Grade de resultados.

### 5.2 Direcao visual

Como a interface deve ser moderna, a proposta visual e:

- Layout limpo, espacoso e orientado a cards.
- Tipografia mais forte e contemporanea, evitando visual padrao de CRUD.
- Cores com contraste claro e acentos frios ou energicos, sem parecer uma copia de pokedex tradicional.
- Componentes com cara de search tool moderna, nao de catalogo antigo.
- Responsivo para desktop e mobile.

Sugestao de identidade visual inicial:

- Fonte de destaque: `Space Grotesk` ou equivalente.
- Fonte de leitura: `IBM Plex Sans` ou equivalente.
- Fundo claro com profundidade suave.
- Acentos em cyan, teal ou lime para feedback e destaque.

### 5.3 Componentes principais

- Campo de busca assistida para `abilities`
- Campo de busca assistida para `types`
- Campo de busca assistida para `moves`
- Bloco de regras para `stats`
- Toggle `AND / OR` por grupo
- Botao `Search`
- Botao `Clear filters`
- Estado de carregamento com progresso textual
- Grid de cards de resultado
- Estado vazio com mensagem util
- Estado de erro com tentativa de recuperacao

## 6. Fontes de Dados e Endpoints da PokeAPI

Como a aplicacao sera browser-only, a busca dependera de composicao inteligente de endpoints da PokeAPI.

### 6.1 Endpoints principais

- `GET /api/v2/pokemon?limit=...&offset=...`
  - usado para obter a lista completa de recursos Pokemon quando precisarmos varrer o universo inteiro
- `GET /api/v2/pokemon/{id or name}/`
  - usado para detalhes de cada Pokemon ou forma
  - daqui virao: sprite, types, abilities, moves e base stats
- `GET /api/v2/ability/{id or name}/`
  - usado para obter o conjunto de Pokemon que possuem uma ability
- `GET /api/v2/move/{id or name}/`
  - usado para obter o conjunto de Pokemon que podem aprender um move
- `GET /api/v2/type/{id or name}/`
  - usado para obter o conjunto de Pokemon associados a um type

### 6.2 Uso pratico dos endpoints

Estrutura de reducao de candidatos:

1. Para `abilities`, buscar cada ability escolhida e coletar o conjunto de Pokemon retornado.
2. Para `moves`, buscar cada move escolhido e coletar o conjunto de Pokemon retornado.
3. Para `types`, buscar cada type escolhido e coletar o conjunto de Pokemon retornado.
4. Combinar esses conjuntos conforme a logica `AND/OR` de cada grupo.
5. Interseccionar os grupos ativos.
6. So depois hidratar os detalhes dos candidatos finais via endpoint de `pokemon`.
7. Aplicar regras numericas de `stats` nos detalhes ja hidratados.

Essa estrategia evita baixar detalhes completos de todos os Pokemon logo no inicio quando a busca ja traz filtros fortes como move, type ou ability.

## 7. Arquitetura Proposta

Mesmo sem framework, o projeto deve ser organizado em modulos ES.

Estrutura sugerida:

- `index.html`
- `styles/`
- `styles/main.css`
- `src/main.js`
- `src/config.js`
- `src/state/store.js`
- `src/api/pokeapi.js`
- `src/cache/cache.js`
- `src/cache/indexeddb.js`
- `src/search/query-model.js`
- `src/search/query-engine.js`
- `src/search/set-logic.js`
- `src/ui/filters.js`
- `src/ui/results.js`
- `src/ui/status.js`
- `src/utils/normalize.js`

### 7.1 Responsabilidades

- `api/pokeapi.js`
  - centralizar fetches, retries simples, normalizacao basica e tratamento de erro
- `cache/`
  - persistir respostas e evitar refetch desnecessario
- `search/`
  - transformar filtros em conjuntos e aplicar logica `AND/OR`
- `ui/`
  - renderizar componentes, cards, estados de loading e mensagens
- `state/`
  - manter query atual, resultados e estado da interface

## 8. Modelo de Dados Interno

Mesmo vindo de multiplos endpoints, cada resultado deve ser normalizado para um formato unico no front-end.

Formato sugerido do resultado:

```js
{
  id: 727,
  name: "incineroar",
  sprite: "https://...",
  types: ["fire", "dark"],
  abilities: ["blaze", "intimidate"],
  moves: ["parting-shot", "..."],
  stats: {
    hp: 95,
    attack: 115,
    defense: 90,
    "special-attack": 80,
    "special-defense": 90,
    speed: 60
  },
  url: "https://pokeapi.co/api/v2/pokemon/727/"
}
```

Observacao:

- `moves` podem ser armazenados so no cache interno e nao precisam aparecer no card.
- `stats` tambem podem ficar fora do card inicial, mas precisam estar disponiveis para validacao.

## 9. Estrategia de Busca

### 9.1 Bootstrap inicial

Ao abrir a aplicacao:

- carregar lista de `types` imediatamente
- carregar listas nominais de `abilities` e `moves` para autocomplete
- nao carregar detalhes completos de todos os Pokemon

Objetivo:

- permitir digitacao assistida
- evitar custo alto antes de a pessoa de fato buscar

### 9.2 Fluxo ao clicar em Search

1. Validar se existe pelo menos um filtro.
2. Normalizar os nomes digitados para o formato esperado pela API.
3. Resolver conjuntos por grupo:
   - abilities
   - types
   - moves
   - stats
4. Se existirem grupos baseados em conjunto, usa-los para reduzir candidatos antes da hidratacao.
5. Se a busca tiver apenas stats, obter a lista completa de Pokemon e hidratar em lotes.
6. Buscar detalhes de candidatos ainda nao cacheados.
7. Aplicar regras de stats.
8. Renderizar os cards.
9. Salvar resultados e dados no cache local.

### 9.3 Busca baseada so em stats

Este e o caso mais pesado da arquitetura browser-only. Como nao existe um endpoint nativo da PokeAPI para filtrar Pokemon diretamente por base stat, a aplicacao precisara:

1. obter a lista completa de Pokemon
2. buscar detalhes em lotes
3. extrair stats
4. filtrar localmente

Mitigacoes planejadas:

- executar requests em lotes pequenos
- mostrar progresso
- cache persistente entre sessoes
- reutilizar dados ja baixados em buscas futuras

## 10. Estrategia de Cache

Como a propria documentacao da PokeAPI recomenda cache local, este projeto deve tratar cache como parte central da arquitetura.

### 10.1 Camadas de cache

- `Memory cache`
  - para respostas da sessao atual
- `IndexedDB`
  - para persistencia entre sessoes
- `localStorage`
  - apenas para preferencias leves, ultima query e versao do cache

### 10.2 O que sera cacheado

- detalhes de `pokemon`
- respostas de `ability`
- respostas de `move`
- respostas de `type`
- listas nominais para autocomplete

### 10.3 Politica sugerida

- `stale-while-revalidate` simples quando fizer sentido
- invalidacao por versao interna do app
- TTL sugerido para dados remotos: `7 dias`

## 11. Regras de Performance

Para nao abusar da PokeAPI e manter a UX aceitavel:

- limitar concorrencia de fetches
- deduplicar requests em andamento
- abortar buscas antigas quando uma nova for disparada
- evitar re-hidratacao de Pokemon ja cacheados
- mostrar resultados assim que o lote final for consistente

Faixa inicial recomendada:

- concorrencia de `5` a `10` requests simultaneos para detalhes de Pokemon

## 12. Tratamento de Casos de Borda

- nomes com hifen: `mr-mime`, `ho-oh`, `porygon-z`
- formas especiais: `tauros-paldea-blaze-breed`, `meowstic-f`, `arcanine-hisui`
- sprites ausentes em algumas formas
- ability escondida contra ability normal
- Pokemon com um ou dois tipos
- buscas que retornam zero resultados
- erro de digitacao em move ou ability
- indisponibilidade temporaria da API

Decisoes de UX para esses casos:

- usar autocomplete sempre que possivel
- mostrar mensagem clara quando nao houver resultados
- exibir fallback visual quando o sprite estiver ausente
- indicar loading e erro sem quebrar a tela

## 13. Estrategia de Interface para Regras

Para equilibrar poder de busca com simplicidade:

- cada grupo tera um titulo claro
- cada grupo tera um toggle de `AND / OR`
- o usuario adiciona valores como chips ou tokens
- stats terao uma lista de regras

Exemplo de stats:

- `speed >= 60`
- `attack >= 100`
- operador do grupo: `AND` ou `OR`

Isso permite manter o caso simples facil de usar, sem prender a arquitetura a um formulario rigido demais.

## 14. Estrategia de Renderizacao dos Resultados

Cada resultado deve mostrar:

- `sprite`
- `name`
- `types`
- `abilities`

Card sugerido:

- topo com sprite
- nome com boa hierarquia visual
- badges de type
- lista curta de abilities
- opcional em etapa futura: botao `See details`

## 15. Acessibilidade e Usabilidade

Mesmo sendo um projeto visualmente forte, a base deve ser acessivel:

- contraste suficiente
- foco visivel por teclado
- labels claros
- areas clicaveis confortaveis
- suporte responsivo
- loading e erros com texto, nao so cor

## 16. Riscos Tecnicos

### 16.1 Peso da abordagem browser-only

Risco:

- consultas amplas, especialmente as baseadas so em stats, podem exigir muitos downloads

Mitigacao:

- cache persistente
- busca por conjuntos antes da hidratacao completa
- progresso visual
- exigencia de pelo menos um filtro

### 16.2 Dependencia de API externa

Risco:

- latencia, quedas ou respostas incompletas da PokeAPI

Mitigacao:

- retries leves
- mensagens de erro claras
- armazenamento local do que ja foi baixado

### 16.3 Complexidade da logica `AND/OR`

Risco:

- bugs de logica entre operadores por grupo

Mitigacao:

- modelar a query explicitamente
- criar testes de unidade para o motor de combinacao
- validar cenarios manuais conhecidos

## 17. Fora de Escopo Inicial

Para manter o projeto viavel na primeira versao, estes itens ficam fora do escopo inicial:

- backend proprio
- banco de dados
- autenticacao
- favoritos e contas
- comparacao lado a lado entre Pokemon
- filtros por generation, egg group, nature ou damage class
- deploy imediato

## 18. Roadmap de Implementacao

### Fase 0 - Documentacao

- consolidar este plano
- revisar suposicoes
- congelar escopo da v1

### Fase 1 - Base do Projeto

- criar estrutura de pastas
- configurar HTML base
- configurar CSS base e tokens visuais
- configurar modulos JS

### Fase 2 - UI da Busca

- montar layout principal
- construir grupos de filtro
- criar chips, toggles e rules builder de stats
- criar estados de loading, erro e vazio

### Fase 3 - Camada de Dados

- implementar cliente da PokeAPI
- implementar cache em memoria
- implementar persistencia em IndexedDB
- implementar bootstrap de lists para autocomplete

### Fase 4 - Motor de Busca

- implementar operadores `AND/OR`
- montar reducao por conjuntos de type, move e ability
- implementar hidratacao de candidatos
- aplicar filtros numericos

### Fase 5 - Renderizacao de Resultados

- montar cards finais
- exibir sprite, name, types e abilities
- lidar com formas separadas

### Fase 6 - Polimento

- refinamento visual
- responsividade
- performance
- mensagens de erro melhores

### Fase 7 - Teste e Validacao

- cenarios manuais
- testes do motor de busca
- testes de cache e retry

## 19. Criterios de Aceite da V1

O projeto sera considerado funcional quando:

1. A pagina inicial abrir sem listar Pokemon por padrao.
2. O usuario puder adicionar filtros de `ability`, `type`, `move` e `stats`.
3. Cada grupo permitir modo `AND` ou `OR`.
4. O botao `Search` executar a busca somente quando clicado.
5. Os resultados mostrarem `name`, `sprite`, `types` e `abilities`.
6. Formas aparecerem separadamente quando a API as tratar como Pokemon distintos.
7. O sistema conseguir responder a uma busca como:
   - `ability = intimidate`
   - `type = dark`
   - `move = parting-shot`
   - `speed >= 60`
8. O sistema usar cache local para reduzir novas consultas.
9. A interface funcionar em desktop e mobile.

## 20. Cenarios de Teste Prioritarios

- `type = dark`
- `type = dark OR ghost`
- `ability = intimidate`
- `move = parting-shot`
- `type = dark AND move = parting-shot`
- `ability = intimidate AND type = dark AND speed >= 60`
- `attack >= 100 OR speed >= 90`
- busca com forma especial que deva aparecer separada
- busca sem resultados
- busca com valor invalido digitado manualmente

## 21. Decisao Arquitetural Importante

Como voce preferiu a abordagem `frontend 100% browser-only`, este plano assume que a primeira versao aceitara um custo inicial maior em algumas buscas para evitar qualquer etapa local de pre-processamento. Se mais adiante essa escolha prejudicar muito a experiencia, o plano de contingencia sera introduzir um script local opcional para gerar um indice estatico, sem mudar a interface.

## 22. Proximo Passo Depois da Aprovacao Deste Plano

Depois da sua aprovacao, a implementacao deve seguir nesta ordem:

1. scaffold do projeto em JavaScript puro
2. layout moderno da tela de busca
3. cliente da PokeAPI com cache
4. motor de filtros `AND/OR`
5. cards de resultado e refinamento visual

