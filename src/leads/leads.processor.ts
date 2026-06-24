import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('leads-queue')
export class LeadsProcessor extends WorkerHost {
    constructor(private readonly prisma: PrismaService) {
        super();
    }
    
    async process(job: Job<any, any, string>): Promise<any> {
        const { name, email, phone, source } = job.data;

        //1. Limpeza a padronização dos dados em background
        const cleanedName = name.trim();
        const cleanedPhone = phone.replace(/\D/g, ''); //Mantem apenas números

        //2. Salva no banco PostgreSQL via Prisma
        const lead = await this.prisma.lead.create({
            data: {
                name: cleanedName,
                email: email.toLowerCase().trim(),
                phone: cleanedPhone,
                source: source,
                status: 'PROCESSED',
                userId: 'default', // Adicionado pois o schema requer este campo
            },
        });
        //3. Cria o log de auditoria
        await this.prisma.log.create({
            data: {
                leadId: lead.id,
                message: `[Fila] Lead processado de forma assíncrona da origem ${source}`,
            },
        });
        console.log(`[Redis] Lead ${lead.name} processado com sucesso!`);
    }
}