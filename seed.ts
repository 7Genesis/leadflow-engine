process.loadEnvFile();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prismaService = app.get(PrismaService);

  console.log('Iniciando injeção de dados usando o motor do NestJS...');

  // 🟢 CORREÇÃO: Acesso usando .db
  await prismaService.db.user.createMany({
    data: [
      { name: 'Ana Silva', email: 'ana@teste.com', role: 'Sales' },
      { name: 'Bruno Costa', email: 'bruno@teste.com', role: 'Sales' },
      { name: 'Carlos Dias', email: 'carlos@teste.com', role: 'Sales' },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Time de vendas (Users) criado com sucesso no banco!');
  
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Erro ao executar o seed:', err);
  process.exit(1);
});