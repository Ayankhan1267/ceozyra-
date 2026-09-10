/**
 * ZYRA — Segments Service (CRM Phase 3)
 * Business logic for segments CRUD + dynamic evaluation
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface CreateSegmentDto {
  name: string;
  description?: string;
  rules?: Record<string, unknown>;
  isDynamic?: boolean;
}

export interface EvaluateSegmentDto {
  customerIds?: string[];
}

@Injectable()
export class SegmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.segment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const segment = await this.prisma.segment.findFirst({ where: { id, tenantId } });
    if (!segment) throw new NotFoundException('Segment not found');
    return segment;
  }

  async create(tenantId: string, dto: CreateSegmentDto) {
    const segment = await this.prisma.segment.create({
      data: {
        name: dto.name,
        description: dto.description,
        rules: dto.rules as any ?? {},
        customerIds: [],
        isDynamic: dto.isDynamic ?? true,
        tenantId,
      },
    });

    this.eventBus.emit('segment.created', { segmentId: segment.id, tenantId });
    return segment;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const segment = await this.prisma.segment.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!segment) throw new NotFoundException('Segment not found');

    const updated = await this.prisma.segment.update({
      where: { id },
      data,
    });

    this.eventBus.emit('segment.updated', { segmentId: id, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const segment = await this.prisma.segment.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!segment) throw new NotFoundException('Segment not found');

    await this.prisma.segment.delete({ where: { id } });
    this.eventBus.emit('segment.deleted', { segmentId: id, tenantId });
    return { success: true };
  }

  async evaluate(id: string, tenantId: string, _dto: EvaluateSegmentDto) {
    const segment = await this.prisma.segment.findFirst({ where: { id, tenantId } });
    if (!segment) throw new NotFoundException('Segment not found');

    // Dynamic evaluation: re-compute matching customer IDs based on rules
    let customerIds: string[] = [];

    if (segment.rules && segment.isDynamic) {
      const where: Record<string, unknown> = { tenantId };
      const rules = segment.rules as Record<string, unknown>;

      if (rules.segment) {
        where.segment = rules.segment as string;
      }
      if (rules.source) {
        where.source = rules.source as string;
      }
      if (rules.minOrderValue || rules.maxOrderValue) {
        // For numeric filters, we need to aggregate orders
        const customers = await this.prisma.customer.findMany({
          where,
          select: { id: true },
        });
        const filtered = [];
        for (const c of customers) {
          const agg = await this.prisma.order.aggregate({
            where: { customerId: c.id, status: 'COMPLETED' },
            _sum: { total: true },
          });
          const total = Number(agg._sum.total) || 0;
          if (rules.minOrderValue && total < (rules.minOrderValue as number)) continue;
          if (rules.maxOrderValue && total > (rules.maxOrderValue as number)) continue;
          filtered.push(c.id);
        }
        customerIds = filtered;
      } else {
        const matching = await this.prisma.customer.findMany({
          where,
          select: { id: true },
        });
        customerIds = matching.map((c) => c.id);
      }
    }

    const updated = await this.prisma.segment.update({
      where: { id },
      data: { customerIds },
    });

    this.eventBus.emit('segment.evaluated', { segmentId: id, count: customerIds.length, tenantId });
    return updated;
  }
}
