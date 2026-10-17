import { Controller, Post, Body } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { CreateLeadDto } from './dto/create-lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(@InjectQueue('lead-queue') private readonly leadsQueue: Queue) {}

  @Post('webhook')
  async receiveWebhook(@Body() data: CreateLeadDto) {
    await this.leadsQueue.add('process-lead', data, {
      attempts: 3,
      backoff: 5000,
    });
    return { success: true, message: 'Lead na fila de processamento.' };
  }
}
