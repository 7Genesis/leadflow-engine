import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LeadsModule } from './leads/leads.module';

@Module({
  imports: [PrismaModule, LeadsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
