/**
 * ZYRA — Conversations Service (Phase 4 Communications)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface CreateConversationDto {
  customerId?: string;
  channel: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationFilter {
  customerId?: string;
  channel?: string;
  status?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string, filter: ConversationFilter) {
    const where: Record<string, unknown> = {};
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;

    const skip = (filter.page - 1) * filter.limit;
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { lastMessageAt: 'desc' },
        include: { customer: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { conversations, total, page: filter.page, limit: filter.limit, totalPages: Math.ceil(total / filter.limit) };
  }

  async findById(id: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, email: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getMessages(conversationId: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId }, select: { id: true } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOrCreate(tenantId: string, dto: CreateConversationDto) {
    if (!dto.customerId) throw new BadRequestException('customerId is required');

    let conversation = await this.prisma.conversation.findFirst({
      where: { tenantId, customerId: dto.customerId, channel: dto.channel as any },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          channel: dto.channel as any,
          externalId: dto.externalId,
          metadata: dto.metadata as any,
          status: 'OPEN',
        },
      });
      this.eventBus.emit('conversation.created', { conversationId: conversation.id, tenantId });
    }

    return conversation;
  }

  async create(tenantId: string, dto: CreateConversationDto) {
    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        channel: dto.channel as any,
        externalId: dto.externalId,
        metadata: dto.metadata as any,
        status: 'OPEN',
      },
      include: { customer: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    this.eventBus.emit('conversation.created', { conversationId: conversation.id, tenantId });
    return conversation;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const updated = await this.prisma.conversation.update({
      where: { id },
      data,
      include: { customer: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    this.eventBus.emit('conversation.updated', { conversationId: id, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    await this.prisma.conversation.delete({ where: { id } });
    this.eventBus.emit('conversation.deleted', { conversationId: id, tenantId });
    return { success: true };
  }
}
