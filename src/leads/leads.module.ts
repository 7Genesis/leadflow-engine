import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { LeadsController } from './leads.controller';
import { LeadsProcessor } from './leads.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'lead-queue',
    }),
    // 2. Vinculamos a fila 'lead-queue' ao adaptador do painel visual
    BullBoardModule.forFeature({
      name: 'lead-queue',
      adapter: BullAdapter, 
    }),
  ],
  controllers: [LeadsController],
  providers: [LeadsProcessor],
})
export class LeadsModule {}