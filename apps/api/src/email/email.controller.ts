/**
 * ZYRA — Email Controller
 *
 * Endpoints:
 *   POST   /email/send            — send a custom email (admin only)
 *   POST   /email/send-template   — send from a named template
 *   GET    /email/templates       — list available email templates
 *   GET    /email/health          — verify SMTP connection (admin only)
 */

import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { type TemplateName } from './email.templates';

export class SendEmailDto {
  to!: string;
  subject!: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tenantId?: string;
}

export class SendTemplateDto {
  template!: TemplateName;
  to!: string;
  data!: Record<string, string>;
  tenantId?: string;
}

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @UseGuards(AuthGuard, RolesGuard)
  sendEmail(@Body() dto: SendEmailDto) {
    return this.emailService.sendEmail(dto);
  }

  @Post('send-template')
  @UseGuards(AuthGuard, RolesGuard)
  sendTemplate(@Body() dto: SendTemplateDto) {
    return this.emailService.sendTemplate(dto.template, dto.to, dto.data, dto.tenantId);
  }

  @Get('templates')
  @UseGuards(AuthGuard, RolesGuard)
  getTemplates() {
    return this.emailService.getAvailableTemplates();
  }

  @Get('health')
  @UseGuards(AuthGuard, RolesGuard)
  async health() {
    const ok = await this.emailService.verifyConnection();
    return {
      status: ok ? 'connected' : 'disconnected',
      smtpConfigured: ok,
      timestamp: new Date().toISOString(),
    };
  }
}
