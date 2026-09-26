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

## Estrutura

```
src/leads/leads.controller.ts   recebe o webhook e enfileira
src/leads/leads.processor.ts    worker que consome a fila
src/leads/leads.service.ts      transação de atribuição (round-robin)
src/prisma/                     conexão com o PostgreSQL (Prisma 7 + adapter-pg)
prisma/                         schema, migrations e seed
```

## Testes do rodízio

O teste manda 300 leads, 10 por vez, para 3 vendedores e exige que a diferença entre quem mais e quem menos recebeu fique em no máximo 12 leads (o ideal é 100 para cada). Como ele apaga vendedores e leads, só roda contra um banco cujo nome termina em `_test`.

```bash
docker compose exec postgres createdb -U postgres leadflow_test
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/leadflow_test?schema=public"
npx prisma migrate deploy
npm run test:rodizio
```

Medição feita com 10 rodadas de 300 leads, 10 simultâneos, PostgreSQL 15:

| Estratégia | Diferença média entre o vendedor que mais e o que menos recebeu | Maior fatia (ideal: 100) |
|---|---|---|
| `FOR UPDATE` | 33,7 (de 20 a 54) | 133 |
| `FOR UPDATE SKIP LOCKED` | 3,2 (de 0 a 5) | 103 |

Com `FOR UPDATE` sozinho, quem esperava o bloqueio já tinha escolhido o mesmo vendedor e o recebia de novo quando o outro lead terminava.

## Limitações e próximos passos

- **Validação do payload:** o `CreateLeadDto` (com class-validator) já existe, mas o controller ainda usa uma interface local, então o webhook não valida o corpo em tempo de execução.
- **Tentativas:** o `LeadsService.handleIncomingLead` define tentativas e backoff, mas o controller enfileira sem essas opções.
- **Testes:** o rodízio sob concorrência tem teste (veja a seção acima); ainda faltam testes do processor e do endpoint do webhook.
