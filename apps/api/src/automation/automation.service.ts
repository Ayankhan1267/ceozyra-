/**
 * ZYRA — Automation Service (Phase 4 Communications)
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface AutomationFilter {
  triggerType?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string, filter: AutomationFilter) {
    const where: Record<string, unknown> = { tenantId };
    if (filter.triggerType) where.triggerType = filter.triggerType;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const skip = (filter.page - 1) * filter.limit;
    const [rules, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.automationRule.count({ where }),
    ]);

    return { rules, total, page: filter.page, limit: filter.limit, totalPages: Math.ceil(total / filter.limit) };
  }

  async findById(id: string, tenantId: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  async create(tenantId: string, data: Record<string, unknown>) {
    const rule = await this.prisma.automationRule.create({
      data: { ...data, tenantId } as any,
    });
    this.eventBus.emit('automation.created', { ruleId: rule.id, tenantId });
    return rule;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!rule) throw new NotFoundException('Automation rule not found');

    const updated = await this.prisma.automationRule.update({ where: { id }, data });
    this.eventBus.emit('automation.updated', { ruleId: id, tenantId });
    return updated;
  }

  async toggle(id: string, tenantId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, tenantId },
      select: { id: true, isActive: true },
    });
    if (!rule) throw new NotFoundException('Automation rule not found');

    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });

    this.eventBus.emit('automation.toggled', { ruleId: id, isActive: !rule.isActive, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!rule) throw new NotFoundException('Automation rule not found');

    await this.prisma.automationRule.delete({ where: { id } });
    this.eventBus.emit('automation.deleted', { ruleId: id, tenantId });
    return { success: true };
  }

  async trigger(id: string, tenantId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, tenantId, isActive: true },
      select: { id: true, triggerType: true, triggerConfig: true, actions: true },
    });
    if (!rule) throw new NotFoundException('Automation rule not found or inactive');

    this.eventBus.emit('automation.triggered', { ruleId: id, triggerType: rule.triggerType, tenantId });

    return {
      success: true,
      ruleId: id,
      triggerType: rule.triggerType,
      triggeredAt: new Date().toISOString(),
    };
  }
}
