import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global // Torna o módulo visivel na aplicação inteira sem precisar reimportar
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
