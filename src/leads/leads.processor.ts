import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Processor('lead-queue')
export class LeadsProcessor {
  constructor(private prismaService: PrismaService) {}

  @Process('process-lead')
  async handleLead(job: Job) {
    console.log('--- Processando novo lead da fila ---');
    const data = job.data;

    try {
      // Iniciamos uma transação para garantir que a inserção do Lead 
      // e a atualização do vendedor ocorram no mesmo pulso do banco.
      await this.prismaService.db.$transaction(async (tx) => {
        
        // 1. Busca o vendedor ativo há mais tempo sem receber leads
        const salesperson = await tx.user.findFirst({
          where: { isActive: true },
          orderBy: { lastAssignedLeadAt: 'asc' },
        });

        if (!salesperson) {
          console.log('⚠️ Nenhum vendedor ativo encontrado para receber o lead.');
          return;
        }

        // 2. Registra o Lead e vincula ao ID do vendedor selecionado
        await tx.lead.create({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            source: data.source,
            status: data.status || 'New',
            userId: salesperson.id, // O relacionamento chave
          },
        });

        // 3. Atualiza o relógio temporal do vendedor para o final da fila
        await tx.user.update({
          where: { id: salesperson.id },
          data: { lastAssignedLeadAt: new Date() },
        });

        console.log(`✅ Sucesso! Lead "${data.name}" atribuído ao vendedor: ${salesperson.name}`);
      });
      
    } catch (error) {
      console.error('❌ Falha crítica ao gravar lead no banco:', error);
      // Lançar o erro faz com que o Bull saiba que o processamento falhou
      // e coloque o job de volta na fila para ser tentado novamente (retry).
      throw error; 
    }
  }
}