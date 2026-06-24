import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsProcessor } from './leads.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'leads-queue',
    }),
  ],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    LeadsProcessor
  ],
})
export class LeadsModule {}
