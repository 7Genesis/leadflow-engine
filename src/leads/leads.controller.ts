import { Controller, Post, Body } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

export interface CreateLeadDto {
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status?: string;
  priority?: number;
}

@Controller('leads')
export class LeadsController {
  constructor(@InjectQueue('lead-queue') private readonly leadsQueue: Queue) {}

  @Post('webhook')
  async receiveWebhook(@Body() data: CreateLeadDto) {
    await this.leadsQueue.add('process-lead', data);
    return { success: true, message: 'Lead na fila de processamento.' };
  }
}