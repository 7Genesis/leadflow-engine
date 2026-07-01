import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectQueue('lead-queue') private readonly leadsQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  // Ingestão assíncrona (Fail-Fast). Libera a requisição web imediatamente.
  async handleIncomingLead(dto: CreateLeadDto) {
    await this.leadsQueue.add('process-lead', dto, {
      attempts: 3,
      backoff: 5000,
      priority: dto.priority || 0,
    });
    
    return { success: true, message: 'Lead na fila.' };
  }

  // Execução atômica. O PostgreSQL garante a integridade sob alta concorrência.
  async processAndAssignLead(dto: CreateLeadDto) {
    return await this.prisma.db.$transaction(async (tx) => {
      
      // Bloqueio pessimista (FOR UPDATE): Impede leituras sujas em requisições simultâneas
      const users = await tx.$queryRaw<any[]>`
        SELECT id, name 
        FROM "User" 
        WHERE "isActive" = true 
        ORDER BY "lastAssignedLeadAt" ASC 
        LIMIT 1 
        FOR UPDATE
      `;

      if (!users || users.length === 0) {
        throw new Error('Nenhum vendedor ativo encontrado.');
      }

      const selectedUser = users[0];

      // Criação do lead e atribuição vinculadas à mesma transação
      const newLead = await tx.lead.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone || '',
          source: dto.source || '',
          priority: dto.priority || 1,
          status: 'Assigned',
          userId: selectedUser.id,
        },
      });

      // Rotação do Round-Robin: envia o vendedor para o final da fila
      await tx.user.update({
        where: { id: selectedUser.id },
        data: { lastAssignedLeadAt: new Date() },
      });

      this.logger.log(`Lead "${newLead.name}" atribuído a: ${selectedUser.name}`);
      
      return { lead: newLead, user: selectedUser };
    });
  }
}