import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async handleIncomingLead(dto: CreateLeadDto) {
    // 1. Higienização dos dados (Tratamento)
    const cleanedName = dto.name.trim();
    // Remove parênteses, espaços e hifens do telefone para deixar apenas números
    const cleanedPhone = dto.phone.replace(/\D/g, '');

    // 2. Persistência no PostgreSQL
    const lead = await this.prisma.lead.create({
      data: {
        name: cleanedName,
        email: dto.email.toLowerCase().trim(),
        phone: cleanedPhone,
        source: dto.source,
        status: 'PENDING', // Fica pendente até ser distribuído/enviado para o chat
      },
    });

    // 3. Criar um log de auditoria no banco
    await this.prisma.log.create({
      data: {
        leadId: lead.id,
        message: `Lead recebido e higienizado com sucesso da origem: ${dto.source}`,
      },
    });

    return {
      message: 'Lead recebido com sucesso',
      leadId: lead.id,
    };
  }
}