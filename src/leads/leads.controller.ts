import { Controller, Post, Body } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('webhook')
  async handleWebhook(@Body() leadData: CreateLeadDto) {
    // 🟢 Ajustado para o nome correto do método: handleIncomingLead
    return await this.leadsService.handleIncomingLead(leadData);
  }
}