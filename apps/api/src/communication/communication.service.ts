/**
 * ZYRA — Communication Service
 */

import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

export interface SendEmailDto {
  to: string;
  subject: string;
  html: string;
  tenantId: string;
}

export interface SendWhatsAppDto {
  to: string;
  message: string;
  tenantId: string;
}

export interface SendSmsDto {
  to: string;
  message: string;
  tenantId: string;
}

export interface SendWhatsAppDirectInput {
  to: string;
  message: string;
  tenantId?: string;
}

export interface SendWhatsAppTemplateInput {
  to: string;
  templateName: string;
  components?: Record<string, unknown>[];
  tenantId?: string;
  languageCode?: string;
}

export interface SendWhatsAppMediaInput {
  to: string;
  mediaUrl: string;
  caption?: string;
  type: 'image' | 'document' | 'audio' | 'video';
  tenantId?: string;
}

@Injectable()
export class CommunicationService {
  constructor(
    private readonly queueService: QueueService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  async sendEmail(dto: SendEmailDto) {
    return this.queueService.addEmailJob('send-email', dto as unknown as Record<string, unknown>);
  }

  async sendWhatsApp(dto: SendWhatsAppDto) {
    return this.whatsappService.sendMessage({ to: dto.to, message: dto.message, tenantId: dto.tenantId });
  }

  async sendWhatsAppDirect(input: SendWhatsAppDirectInput) {
    return this.whatsappService.sendMessage(input);
  }

  async sendWhatsAppTemplate(input: SendWhatsAppTemplateInput) {
    return this.whatsappService.sendTemplateMessage(input);
  }

  async sendWhatsAppMedia(input: SendWhatsAppMediaInput) {
    return this.whatsappService.sendMediaMessage(input);
  }

  async sendSms(dto: SendSmsDto) {
    return this.queueService.addSmsJob('send-sms', dto as unknown as Record<string, unknown>);
  }

  async sendBulkEmail(recipients: string[], subject: string, html: string, tenantId: string) {
    const jobs = recipients.map((to) => ({
      to,
      subject,
      html,
      tenantId,
    }));
    return this.queueService.addEmailJob('bulk-email', { jobs });
  }

  async sendBulkWhatsApp(recipients: string[], message: string, tenantId: string) {
    const jobs = recipients.map((to) => ({ to, message, tenantId }));
    return this.queueService.addWhatsAppJob('bulk-whatsapp', { jobs });
  }
}
