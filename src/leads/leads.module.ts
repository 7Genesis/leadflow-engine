import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsProcessor } from './leads.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'lead-queue',
    }),
    BullBoardModule.forFeature({
      name: 'lead-queue',
      adapter: BullAdapter,
    }),
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsProcessor],
})
export class LeadsModule {}