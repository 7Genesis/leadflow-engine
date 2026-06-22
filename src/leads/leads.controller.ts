import { Controller, Post, Body } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('webhook')
  async handleWebhook(@Body() dto: CreateLeadDto) {
    return this.leadsService.handleIncomingLead(dto);
  }
}
