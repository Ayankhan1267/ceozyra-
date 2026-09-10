/**
 * ZYRA — Messages Service (Phase 4 Communications)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface CreateMessageDto {
  conversationId: string;
  direction: string;
  channel: string;
  body: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMessageStatusDto {
  status: string;
  error?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId }, select: { id: true } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getByConversation(conversationId: string, tenantId: string) {
    return this.list(tenantId, conversationId);
  }

  async findById(id: string, tenantId: string) {
    const message = await this.prisma.message.findFirst({ where: { id, tenantId } });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async create(tenantId: string, dto: CreateMessageDto) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: dto.conversationId, tenantId }, select: { id: true } });
    if (!conversation) throw new BadRequestException('Conversation not found');

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: dto.conversationId,
        direction: dto.direction as any,
        channel: dto.channel as any,
        body: dto.body,
        contentType: dto.contentType || 'text',
        metadata: dto.metadata as any,
      },
    });

    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { lastMessageAt: new Date() },
    });

    this.eventBus.emit('message.created', { messageId: message.id, conversationId: dto.conversationId, tenantId });
    return message;
  }

  async updateStatus(id: string, tenantId: string, dto: UpdateMessageStatusDto) {
    const message = await this.prisma.message.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!message) throw new NotFoundException('Message not found');

    const data: Record<string, unknown> = { status: dto.status as any };
    if (dto.error) data.error = dto.error;

    if (dto.status === 'SENT') data.sentAt = new Date();
    if (dto.status === 'DELIVERED') data.deliveredAt = new Date();
    if (dto.status === 'READ') data.readAt = new Date();

    const updated = await this.prisma.message.update({ where: { id }, data });
    this.eventBus.emit('message.status.updated', { messageId: id, status: dto.status, tenantId });
    return updated;
  }
}
