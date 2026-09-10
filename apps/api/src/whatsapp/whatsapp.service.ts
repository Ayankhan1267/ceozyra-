/**
 * ZYRA — WhatsApp Service (Meta Graph API)
 *
 * Sends messages via WhatsApp Business API.
 * Records outbound messages in whatsapp_messages table.
 * Handles inbound webhook processing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendMessageInput {
  to: string;
  message: string;
  tenantId?: string;
  customerId?: string;
  mediaUrl?: string;
}

export interface SendTemplateInput {
  to: string;
  templateName: string;
  components?: Record<string, unknown>[];
  tenantId?: string;
  customerId?: string;
  language?: string;
}

export interface SendMediaInput {
  to: string;
  mediaUrl: string;
  caption?: string;
  type: 'image' | 'document' | 'video' | 'audio';
  tenantId?: string;
  customerId?: string;
}

export interface WhatsAppMessageResult {
  id: string;
  status: string;
  externalId: string | null;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly appSecret: string;
  private readonly verifyToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
    this.appSecret = process.env.WHATSAPP_APP_SECRET ?? '';
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async sendMessage(input: SendMessageInput): Promise<WhatsAppMessageResult> {
    const { to, message, tenantId, customerId } = input;
    const toE164 = this.normalisePhone(to);
    const tenant = tenantId ?? 'platform';

    let externalId: string | undefined;
    let sendError: string | undefined;

    try {
      const result = await this._callMetaAPI(
        `/${this.phoneNumberId}/messages`,
        'POST',
        {
          messaging_product: 'whatsapp',
          to: toE164,
          type: 'text',
          text: { body: message, preview_url: false },
        },
      );
      const messageData = result as Record<string, unknown>;
      externalId = (messageData.messages as Array<{ id: string }> | undefined)?.[0]?.id;
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Unknown WhatsApp API error';
      this.logger.error(`WhatsApp send failed to ${toE164}: ${sendError}`);
    }

    const record = await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: tenant,
        customerId,
        direction: 'OUTBOUND',
        body: message,
        status: sendError ? 'FAILED' : 'SENT',
        externalId,
        error: sendError ?? null,
        sentAt: sendError ? null : new Date(),
      },
    });

    return this.toResult(record);
  }

  async sendTemplateMessage(input: SendTemplateInput): Promise<WhatsAppMessageResult> {
    const { to, templateName, components, tenantId, customerId, language } = input;
    const toE164 = this.normalisePhone(to);
    const tenant = tenantId ?? 'platform';

    const templateInner: Record<string, unknown> = {
      name: templateName,
      language: { code: language ?? 'en_US' },
    };

    if (components && components.length > 0) {
      templateInner.components = components;
    }

    const templatePayload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: toE164,
      type: 'template',
      template: templateInner,
    };

    let externalId: string | undefined;
    let sendError: string | undefined;

    try {
      const result = await this._callMetaAPI(
        `/${this.phoneNumberId}/messages`,
        'POST',
        templatePayload,
      );
      const messageData = result as Record<string, unknown>;
      externalId = (messageData.messages as Array<{ id: string }> | undefined)?.[0]?.id;
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Unknown WhatsApp API error';
      this.logger.error(`WhatsApp template send failed to ${toE164}: ${sendError}`);
    }

    const record = await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: tenant,
        customerId,
        direction: 'OUTBOUND',
        body: `[template: ${templateName}]`,
        status: sendError ? 'FAILED' : 'SENT',
        externalId,
        error: sendError ?? null,
        sentAt: sendError ? null : new Date(),
      },
    });

    return this.toResult(record);
  }

  async sendMediaMessage(input: SendMediaInput): Promise<WhatsAppMessageResult> {
    const { to, mediaUrl, caption, type, tenantId, customerId } = input;
    const toE164 = this.normalisePhone(to);
    const tenant = tenantId ?? 'platform';

    const mediaPayload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: toE164,
      type,
      [type]: { link: mediaUrl },
    };

    if (caption) {
      mediaPayload[type] = { link: mediaUrl, caption };
    }

    let externalId: string | undefined;
    let sendError: string | undefined;

    try {
      const result = await this._callMetaAPI(
        `/${this.phoneNumberId}/messages`,
        'POST',
        mediaPayload,
      );
      const mediaResult = result as Record<string, unknown>;
      externalId = (mediaResult.messages as Array<{ id: string }> | undefined)?.[0]?.id;
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Unknown WhatsApp API error';
      this.logger.error(`WhatsApp media send failed to ${toE164}: ${sendError}`);
    }

    const body = caption ?? `[${type}: ${mediaUrl}]`;

    const record = await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: tenant,
        customerId,
        direction: 'OUTBOUND',
        body,
        status: sendError ? 'FAILED' : 'SENT',
        externalId,
        error: sendError ?? null,
        sentAt: sendError ? null : new Date(),
      },
    });

    return this.toResult(record);
  }

  async handleInboundWebhook(payload: Record<string, unknown>): Promise<WhatsAppMessageResult | null> {
    try {
      const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
      const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
      const value = changes?.value as Record<string, unknown> | undefined;

      if (!value) {
        this.logger.warn('Inbound webhook: no value in payload');
        return null;
      }

      const inboundMessages = value.messages as Array<Record<string, unknown>> | undefined;
      if (!inboundMessages || inboundMessages.length === 0) {
        return null;
      }

      const message = inboundMessages[0];
      const contactsList = (value.contacts as unknown) as Array<{ wa_id?: string }> | undefined;
      const waId = (contactsList && contactsList.length > 0 && contactsList[0]?.wa_id) ?? (message.from as string | undefined);
      const from = message.from as string | undefined;
      const messageType = message.type as string;
      const body = this.extractMessageBody(message, messageType);

      const tenantId = (payload.tenantId as string) ?? 'platform';

      let conversation = await this.prisma.whatsAppConversation.findFirst({
        where: { waId: from, tenantId },
      });

      if (!conversation) {
        conversation = await this.prisma.whatsAppConversation.create({
          data: {
            tenantId,
            waId: from,
            status: 'OPEN',
          },
        });
      }

      const record = await this.prisma.whatsAppMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'INBOUND',
          body,
          status: 'DELIVERED',
          externalId: message.id as string,
        },
      });

      await this.prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      return this.toResult(record);
    } catch (err) {
      this.logger.error(`Webhook handling failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this._callMetaAPI(`/${messageId}/read`, 'POST', {});
      await this.prisma.whatsAppMessage.updateMany({
        where: { externalId: messageId },
        data: { status: 'READ', readAt: new Date() },
      });
      return true;
    } catch (err) {
      this.logger.error(`markAsRead failed for ${messageId}: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  // ─── Private: Meta Graph API ───────────────────────────────────────────────

  private async _callMetaAPI(endpoint: string, method: 'GET' | 'POST', data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Meta Graph API error ${response.status}: ${errText}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  // ─── Private: Helpers ─────────────────────────────────────────────────────

  private normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (!digits.startsWith('+')) return `+${digits}`;
    return digits;
  }

  private stripE164(phone: string): string {
    return phone.replace(/^\+/, '');
  }

  private extractMessageBody(message: Record<string, unknown>, type: string): string {
    switch (type) {
      case 'text':
        return (message.text as Record<string, string>)?.['body'] ?? '';
      case 'image':
        return `[image: ${(message.image as Record<string, string>)?.['url'] ?? ''}]`;
      case 'document':
        return `[document: ${(message.document as Record<string, string>)?.['url'] ?? ''}]`;
      case 'video':
        return `[video: ${(message.video as Record<string, string>)?.['url'] ?? ''}]`;
      case 'audio':
        return `[audio: ${(message.audio as Record<string, string>)?.['id'] ?? ''}]`;
      case 'location':
        const loc = message.location as Record<string, unknown>;
        return `[location: ${loc?.latitude}, ${loc?.longitude}]`;
      case 'interactive':
        return `[interactive: ${(message.interactive as Record<string, unknown>)?.['type'] ?? 'response'}]`;
      default:
        return `[${type}]`;
    }
  }

  private toResult(record: {
    id: string;
    status: string;
    externalId: string | null;
    error: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
  }): WhatsAppMessageResult {
    return {
      id: record.id,
      status: record.status,
      externalId: record.externalId,
      error: record.error,
      sentAt: record.sentAt?.toISOString() ?? null,
      deliveredAt: record.deliveredAt?.toISOString() ?? null,
      readAt: record.readAt?.toISOString() ?? null,
    };
  }
}
