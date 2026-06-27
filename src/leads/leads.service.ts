import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull'; // 🟢 Importante: uso de 'type' para o compilador
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(@InjectQueue('lead-queue') private readonly leadsQueue: Queue) {}

  async handleIncomingLead(dto: CreateLeadDto) {
    // Adiciona o job à fila com estratégia de resiliência
    await this.leadsQueue.add('process-lead', dto, {
      attempts: 3,
      backoff: 5000,
      priority: dto.priority || 0, // Prioridade padrão é 0
    });
    return {
      success: true,
      message: 'Lead recebido e enviado para a fila de processamento.',
    };
  }
}