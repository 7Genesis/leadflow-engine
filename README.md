# LeadFlow Engine

Recebe leads por webhook e os distribui entre vendedores em rodízio (round-robin), sem deixar quem chama esperando o banco de dados. Feito com **NestJS**, **Bull (Redis)**, **Prisma** e **PostgreSQL**.

## Por que existe

Se o webhook aplica as regras e grava no banco na mesma requisição, a latência sobe e um pico de leads (uma campanha do Meta Ads, por exemplo) pode estourar o tempo de resposta e fazer o lead se perder. Aqui, receber e processar são etapas separadas por uma fila.

## Como funciona

1. `POST /leads/webhook` coloca o lead na fila `lead-queue` (Redis) e responde na hora.
2. Um worker (`LeadsProcessor`) consome a fila. Numa única transação, ele escolhe o vendedor ativo que recebeu lead há mais tempo (`lastAssignedLeadAt`), cria o lead já atribuído a ele e atualiza a vez desse vendedor.
3. A escolha do vendedor usa bloqueio pessimista com `SELECT ... FOR UPDATE SKIP LOCKED`: se outro lead já está sendo atribuído a um vendedor, ele é pulado. Se todos estiverem ocupados, o serviço espera alguns milissegundos e tenta de novo.
4. O painel **Bull Board** mostra o estado dos jobs (aguardando, ativo, concluído e falho) em `/admin/queues`.

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

## CI

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em push na `main` e em pull request. Ele sobe um PostgreSQL com o banco `leadflow_test`, instala as dependências, gera o Prisma Client, compila, roda `npm test`, aplica as migrations e roda o `test:rodizio` (de verdade, não pulado). Um segundo job faz o build da imagem Docker. O lint (`npm run lint`) não está no CI: hoje ele aponta erros de formatação do Prettier em vários arquivos.

## Limitações e próximos passos

- **`npm run start:prod`:** aponta para `node dist/main`, mas o build gera `dist/src/main.js` (a imagem Docker já usa o caminho certo).

- **Validação do payload:** o `CreateLeadDto` (com class-validator) já existe, mas o controller ainda usa uma interface local, então o webhook não valida o corpo em tempo de execução.
- **Tentativas:** o `LeadsService.handleIncomingLead` define tentativas e backoff, mas o controller enfileira sem essas opções.
- **Testes:** o rodízio sob concorrência tem teste (veja a seção acima); ainda faltam testes do processor e do endpoint do webhook.
