import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Processor('lead-queue')
export class LeadsProcessor {
  constructor(private readonly leadsService: LeadsService) {}

  // O decorator deve estar imediatamente acima da declaração do método
  @Process('process-lead')
  async handleLead(job: Job<CreateLeadDto>) {
    try {
      await this.leadsService.processAndAssignLead(job.data);
    } catch (error) {
      console.error('Falha no processamento, reenviando para a fila:', error);
      throw error;
    }
  }
}