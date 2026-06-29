import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db: PrismaClient;
  private readonly pool: Pool;

  constructor() {
    // Alinha a rota de conexão: Prioriza o .env, com fallback direto para o Docker (porta 5433 e banco leadflow_db)
    // O uso de 127.0.0.1 contorna o bug de resolução de IPv6 do Node 22
    const connectionString =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/leadflow_db?schema=public';

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool);
    this.db = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    try {
      await this.db.$connect();
      console.log(' Conectado ao banco "leadflow_db" (Docker) com sucesso!');
    } catch (e) {
      console.error(' Erro crítico ao conectar no banco:', e);
    }
  }

  async onModuleDestroy() {
    try {
      await this.db.$disconnect();
      console.log(' Desconectado do banco "leadflow_db" com sucesso!');
    } catch (e) {
      console.error('Erro crítico ao desconectar do banco:', e);
    }
    await this.pool.end();
  }
}