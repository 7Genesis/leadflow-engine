import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { LeadsModule } from './leads/leads.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // 1. Conexão base com o Redis
    BullModule.forRoot({
      redis: {
        // Padrão: o Redis do docker-compose.yml acessado da máquina local (porta 6380)
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6380),
      },
    }),
    // 2. Inicialização do Painel (Middleware do Express)
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    // 3. Suas lógicas de negócio por último
    LeadsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
