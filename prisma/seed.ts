import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// 1. Tenta quebrar o isolamento do ambiente
dotenv.config();

// 2. Fallback blindado: Se o dotenv injetar "0" variáveis (como ocorreu no erro), usamos a rota física que definimos no Docker
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/leadflow_db?schema=public';

// 3. Inicializa o pool de conexões nativo do PostgreSQL (resolvendo o bloqueio do Prisma)
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// 4. Instancia o cliente cumprindo o contrato estrito que a sua versão exige
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('⏳ Iniciando povoamento do banco de dados isolado...');

  // Limpa a tabela para evitar duplicações em testes futuros
  await prisma.user.deleteMany();

  const user1 = await prisma.user.create({
    data: {
      name: 'Bruna Sammara',
      email: 'Sammara@novalab.com.br',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: 'Genesis Melo',
      email: 'genesis@novalab.com.br',
    },
  });

  console.log('✅ Banco de dados povoado com sucesso:');
  console.log(user1);
  console.log(user2);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Encerra elegantemente o pool de conexões
    await prisma.$disconnect();
  });