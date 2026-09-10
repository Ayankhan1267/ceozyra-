/**
 * ZYRA — Templates Service (Phase 4 Communications)
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface CreateTemplateDto {
  name: string;
  type: string;
  subject?: string;
  body: string;
  variables?: Record<string, unknown>;
  isDefault?: boolean;
}

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.template.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const template = await this.prisma.template.findFirst({ where: { id, tenantId } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async getByType(tenantId: string, type: string) {
    return this.prisma.template.findMany({
      where: { tenantId, type: type as any },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDefault(tenantId: string, type: string) {
    const template = await this.prisma.template.findFirst({
      where: { tenantId, type: type as any, isDefault: true },
    });
    if (!template) throw new NotFoundException('Default template not found');
    return template;
  }

  async create(tenantId: string, dto: CreateTemplateDto) {
    const template = await this.prisma.template.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type as any,
        subject: dto.subject,
        body: dto.body,
        variables: dto.variables as any,
        isDefault: dto.isDefault ?? false,
      },
    });

    this.eventBus.emit('template.created', { templateId: template.id, tenantId });
    return template;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const template = await this.prisma.template.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!template) throw new NotFoundException('Template not found');

    const updated = await this.prisma.template.update({ where: { id }, data });
    this.eventBus.emit('template.updated', { templateId: id, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const template = await this.prisma.template.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!template) throw new NotFoundException('Template not found');

    await this.prisma.template.delete({ where: { id } });
    this.eventBus.emit('template.deleted', { templateId: id, tenantId });
    return { success: true };
  }
}
