import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  //Injecta a fila do Redis chamada 'leads-queue'
  constructor(@InjectQueue('leads-queue') private readonly leadsQueue: Queue) {}

  async handleIncomingLead(dto: CreateLeadDto) {
    // Adiciona o lead como trabalho (job) dentro da fila do Redis
    await this.leadsQueue.add('process-queue', dto, {
      attempts: 3, //Se falhar por instabilidade, tenta repocessar até 3 vezes
      backoff: 5000, //Aguarda 5 segundos entre as tentativas de reprocessamento
    });
    return {
      sucess: true,
      message: 'Lead recebido e enviado para a fila de processamento.',
    };
  }
}