import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsProcessor } from './leads.processor';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'lead-queue',
    }),
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsProcessor, PrismaService],
})
export class LeadsModule {}