/**
 * ZYRA — Communication Controller
 */

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CommunicationService, type SendEmailDto, type SendWhatsAppDto, type SendSmsDto } from './communication.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('communication')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Post('email')
  @UseGuards(AuthGuard, RolesGuard)
  sendEmail(@Body() dto: SendEmailDto) {
    return this.communicationService.sendEmail(dto);
  }

  @Post('whatsapp')
  @UseGuards(AuthGuard, RolesGuard)
  sendWhatsApp(@Body() dto: SendWhatsAppDto) {
    return this.communicationService.sendWhatsApp(dto);
  }

  @Post('sms')
  @UseGuards(AuthGuard, RolesGuard)
  sendSms(@Body() dto: SendSmsDto) {
    return this.communicationService.sendSms(dto);
  }

  @Post('email/bulk')
  @UseGuards(AuthGuard, RolesGuard)
  sendBulkEmail(
    @Body() body: { recipients: string[]; subject: string; html: string; tenantId: string },
  ) {
    return this.communicationService.sendBulkEmail(body.recipients, body.subject, body.html, body.tenantId);
  }

  @Post('whatsapp/bulk')
  @UseGuards(AuthGuard, RolesGuard)
  sendBulkWhatsApp(
    @Body() body: { recipients: string[]; message: string; tenantId: string },
  ) {
    return this.communicationService.sendBulkWhatsApp(body.recipients, body.message, body.tenantId);
  }
}
