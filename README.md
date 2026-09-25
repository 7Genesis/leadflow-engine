# LeadFlow Engine

Recebe leads por webhook e os distribui entre vendedores em rodízio (round-robin), sem deixar quem chama esperando o banco de dados. Feito com **NestJS**, **Bull (Redis)**, **Prisma** e **PostgreSQL**.

## Por que existe

Se o webhook aplica as regras e grava no banco na mesma requisição, a latência sobe e um pico de leads (uma campanha do Meta Ads, por exemplo) pode estourar o tempo de resposta e fazer o lead se perder. Aqui, receber e processar são etapas separadas por uma fila.

## Como funciona

1. `POST /leads/webhook` coloca o lead na fila `lead-queue` (Redis) e responde na hora.
2. Um worker (`LeadsProcessor`) consome a fila. Numa única transação, ele escolhe o vendedor ativo que recebeu lead há mais tempo (`lastAssignedLeadAt`), cria o lead já atribuído a ele e atualiza a vez desse vendedor.
3. A escolha do vendedor usa bloqueio pessimista (`SELECT ... FOR UPDATE`) no registro dele.
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

## Limitações e próximos passos

- **Validação do payload:** o `CreateLeadDto` (com class-validator) já existe, mas o controller ainda usa uma interface local, então o webhook não valida o corpo em tempo de execução.
- **Tentativas:** o `LeadsService.handleIncomingLead` define tentativas e backoff, mas o controller enfileira sem essas opções.
- **Rodízio sob concorrência:** o `FOR UPDATE` protege o registro do vendedor escolhido. Para que dois leads simultâneos não caiam no mesmo vendedor, o passo seguinte é `FOR UPDATE SKIP LOCKED` com uma nova tentativa quando não houver vendedor livre.
- **Testes:** hoje só existe o teste padrão do Nest; faltam testes do processor e da transação.
