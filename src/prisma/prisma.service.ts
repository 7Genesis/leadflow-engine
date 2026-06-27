import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db: PrismaClient;
  private readonly pool: Pool;

  constructor() {
    // Definimos a string manualmente para eliminar a falha de carga do .env
    const connectionString =
      'postgresql://postgres:postgres@localhost:5432/leadflow?schema=public';

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool);
    this.db = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    try {
      await this.db.$connect();
      console.log('✅ Conectado ao banco "leadflow" com sucesso!');
    } catch (e) {
      console.error('❌ Erro crítico ao conectar no banco:', e);
    }
  }

  async onModuleDestroy() {
    try {
      await this.db.$disconnect();
      console.log('✅ Desconectado do banco "leadflow" com sucesso!');
    } catch (e) {
      console.error('❌ Erro crítico ao desconectar do banco:', e);
    }
    await this.pool.end();
  }
}
