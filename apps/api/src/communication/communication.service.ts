/**
 * ZYRA — Communication Service
 */

import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';

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

@Injectable()
export class CommunicationService {
  constructor(private readonly queueService: QueueService) {}

  async sendEmail(dto: SendEmailDto) {
    return this.queueService.addEmailJob('send-email', dto as unknown as Record<string, unknown>);
  }

  async sendWhatsApp(dto: SendWhatsAppDto) {
    return this.queueService.addWhatsAppJob('send-whatsapp', dto as unknown as Record<string, unknown>);
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
