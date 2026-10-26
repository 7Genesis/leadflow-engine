# LeadFlow Engine

[![CI](https://github.com/7Genesis/leadflow-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/7Genesis/leadflow-engine/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licença-MIT-blue.svg)](LICENSE)

Recebe leads por webhook e os distribui entre vendedores em rodízio (round-robin), sem deixar quem chama esperando o banco de dados. Feito com **NestJS**, **Bull (Redis)**, **Prisma** e **PostgreSQL**.

## Problema

Times comerciais recebem leads em rajadas (uma campanha do Meta Ads, por exemplo) e precisam entregar cada um a um vendedor. Distribuir na mão, ou com um script que lê "quem é o próximo" e depois grava, falha justamente no pico: dois leads que chegam juntos veem o mesmo "próximo" e caem no mesmo vendedor, e quem fica esperando o banco pode perder o lead.

O que o projeto garante:

- **Resposta imediata:** o webhook só valida e enfileira; a atribuição acontece depois, no worker.
- **Rodízio justo sob concorrência:** a escolha do vendedor usa `FOR UPDATE SKIP LOCKED`, então leads simultâneos não disputam o mesmo vendedor. Na medição da seção [Testes](#teste-de-concorrência-do-rodízio), a diferença média entre quem mais e quem menos recebeu cai de 33,7 para 3,2 leads (300 leads, 10 simultâneos, 3 vendedores).
- **Atribuição atômica:** criar o lead e passar a vez do vendedor acontecem na mesma transação; ou os dois valem, ou nenhum.

## Por que existe

Se o webhook aplica as regras e grava no banco na mesma requisição, a latência sobe e um pico de leads (uma campanha do Meta Ads, por exemplo) pode estourar o tempo de resposta e fazer o lead se perder. Aqui, receber e processar são etapas separadas por uma fila.

## Como funciona

1. `POST /leads/webhook` coloca o lead na fila `lead-queue` (Redis) e responde na hora.
2. Um worker (`LeadsProcessor`) consome a fila. Numa única transação, ele escolhe o vendedor ativo que recebeu lead há mais tempo (`lastAssignedLeadAt`), cria o lead já atribuído a ele e atualiza a vez desse vendedor.
3. A escolha do vendedor usa bloqueio pessimista com `SELECT ... FOR UPDATE SKIP LOCKED`: se outro lead já está sendo atribuído a um vendedor, ele é pulado. Se todos estiverem ocupados, o serviço espera alguns milissegundos e tenta de novo.
4. O painel **Bull Board** mostra o estado dos jobs (aguardando, ativo, concluído e falho) em `/admin/queues`.

O corpo é validado: `name` e `email` (e-mail válido) são obrigatórios; `phone`, `source` e `priority` (inteiro) são opcionais. Payload inválido recebe `400` e não entra na fila. Cada job é enfileirado com 3 tentativas e espera de 5 segundos entre elas.

Painel Bull Board com os jobs concluídos (leads de exemplo):

![Bull Board mostrando a fila lead-queue com os jobs process-lead concluídos](docs/bull-board.png)

Exemplo de chamada:

```bash
curl -X POST http://localhost:3000/leads/webhook \
  -H "Content-Type: application/json" \
  -d '{ "name": "Maria", "email": "maria@exemplo.com", "phone": "11999999999", "source": "meta-ads" }'
```

## Como rodar

Pré-requisitos: Node.js e Docker.

```bash
docker compose up -d              # PostgreSQL (porta 5433) e Redis (porta 6380)
cp .env.example .env
npm install
npx prisma migrate deploy         # cria as tabelas
npx prisma db seed                # vendedores de exemplo
npm run start:dev                 # API em http://localhost:3000
```

Depois de enviar um lead, abra `http://localhost:3000/admin/queues` para ver o job passando pela fila.

### Tudo em Docker (API + PostgreSQL + Redis)

```bash
docker compose --profile app up --build
```

O perfil `app` acrescenta dois serviços ao compose: `migrate` (roda `prisma migrate deploy` e termina) e `api` (a aplicação, em `http://localhost:3000`). Sem o perfil, `docker compose up -d` sobe só o PostgreSQL e o Redis, como antes. Dentro do compose a API usa `DATABASE_URL`, `REDIS_HOST` e `REDIS_PORT` apontando para os serviços `postgres` e `redis`.

O banco começa sem vendedores. Para ter alguém que receba os leads, rode o seed (ele **apaga todos os vendedores** e cria dois de exemplo):

```bash
docker compose --profile app run --rm migrate npx prisma db seed
```

O `Dockerfile` é multi-stage: o estágio `build` instala as dependências, gera o Prisma Client e compila; o estágio final leva só as dependências de produção e o `dist`, rodando como usuário `node`.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5433/leadflow_db?schema=public` | conexão com o PostgreSQL |
| `REDIS_HOST` | `localhost` | host do Redis da fila |
| `REDIS_PORT` | `6380` | porta do Redis da fila |

## Estrutura

```
src/leads/leads.controller.ts   recebe o webhook e enfileira
src/leads/leads.processor.ts    worker que consome a fila
src/leads/leads.service.ts      transação de atribuição (round-robin)
src/prisma/                     conexão com o PostgreSQL (Prisma 7 + adapter-pg)
prisma/                         schema, migrations e seed
```

## Testes

Testes unitários (não precisam de banco nem de Redis):

```bash
npm test
```

### Teste de concorrência do rodízio

O teste (`test/round-robin.e2e-spec.ts`) manda 300 leads, 10 por vez, para 3 vendedores e exige que a diferença entre quem mais e quem menos recebeu fique em no máximo 12 leads (o ideal é 100 para cada). Há ainda um caso de atribuição em sequência e um caso sem vendedor ativo.

**Ele só roda contra um banco cujo nome termina em `_test`**, porque apaga vendedores, leads e logs. Com qualquer outro nome de banco os 3 casos são **pulados** (o Jest mostra `3 skipped`) e o comando termina sem erro, o que engana. Só precisa do PostgreSQL: a fila é substituída por um stub, então o Redis não é usado.

```bash
docker compose up -d postgres
docker compose exec postgres createdb -U postgres leadflow_test
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/leadflow_test?schema=public"
npx prisma generate
npx prisma migrate deploy
npm run test:rodizio
```

Deu certo quando o Jest mostra `Tests: 3 passed, 3 total`. Use `unset DATABASE_URL` (ou abra outro terminal) depois, para o `npm run start:dev` voltar ao banco `leadflow_db`.

O `npm run test:e2e` roda todos os arquivos `*.e2e-spec.ts`, e hoje não serve: o `test/app.e2e-spec.ts` espera `GET /` responder `Hello World!`, mas o `AppController` não está registrado no `AppModule` (a resposta é 404). Por isso o CI roda apenas o `test:rodizio`.

Medição feita com 10 rodadas de 300 leads, 10 simultâneos, PostgreSQL 15:

| Estratégia | Diferença média entre o vendedor que mais e o que menos recebeu | Maior fatia (ideal: 100) |
|---|---|---|
| `FOR UPDATE` | 33,7 (de 20 a 54) | 133 |
| `FOR UPDATE SKIP LOCKED` | 3,2 (de 0 a 5) | 103 |

Com `FOR UPDATE` sozinho, quem esperava o bloqueio já tinha escolhido o mesmo vendedor e o recebia de novo quando o outro lead terminava.

Os números variam de uma máquina para outra. O script dessa comparação não está versionado: o teste `test:rodizio` cobre só a versão com `SKIP LOCKED`. Para ver a diferença, tire o `SKIP LOCKED` da consulta em `src/leads/leads.service.ts` e rode `npm run test:rodizio` algumas vezes: a diferença sobe e o teste passa a falhar (limite de 12) em parte das execuções.

## CI

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em push na `main` e em pull request. Ele sobe um PostgreSQL com o banco `leadflow_test`, instala as dependências, gera o Prisma Client, compila, roda `npm test`, aplica as migrations e roda o `test:rodizio` (de verdade, não pulado). Um segundo job faz o build da imagem Docker. O workflow também roda o ESLint (com o Prettier) antes do build.

## Limitações e próximos passos

- **Testes:** o rodízio sob concorrência e a validação do payload têm teste; ainda faltam testes do processor e do endpoint do webhook.
- **`npm run test:e2e`:** continua rodando o `test/app.e2e-spec.ts`, que espera `GET /` responder `Hello World!` (veja a seção de testes). Por isso o CI usa só o `test:rodizio`.
- **Autenticação do webhook:** o endpoint é aberto; não há assinatura nem token para quem chama.
