import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreateDealDto {
  tenantId: string;
  title: string;
  description?: string;
  value: number;
  currency?: string;
  stageId: string;
  pipelineId: string;
  customerId?: string;
  leadId?: string;
  assignedTo?: string;
  probability?: number;
  expectedClose?: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, string | undefined>) {
    const tenantId = query.tenantId;
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const where: any = { tenantId };
    if (query.stageId) where.stageId = query.stageId;
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const [deals, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pipeline: { select: { id: true, name: true } },
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return { deals, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, tenantId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId },
      include: {
        pipeline: true,
        customer: true,
        lead: true,
      },
    });
    if (!deal) throw new BadRequestException('Deal not found');
    return deal;
  }

  async create(dto: CreateDealDto) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    return this.prisma.deal.create({
      data: dto as any,
      include: {
        pipeline: true,
        customer: true,
        lead: true,
      },
    });
  }

  async update(id: string, dto: Record<string, unknown>, tenantId: string) {
    const existing = await this.prisma.deal.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Deal not found');
    return this.prisma.deal.update({
      where: { id },
      data: dto,
      include: { pipeline: true, customer: true, lead: true },
    });
  }

  async move(id: string, stageId: string, tenantId: string) {
    const existing = await this.prisma.deal.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Deal not found');

    return this.prisma.deal.update({
      where: { id },
      data: { stageId },
      include: { pipeline: true, customer: true, lead: true },
    });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.deal.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Deal not found');
    await this.prisma.deal.delete({ where: { id } });
    return { success: true };
  }

  async getStats(tenantId: string) {
    const [totalDeals, byStage, totalValue] = await Promise.all([
      this.prisma.deal.count({ where: { tenantId } }),
      this.prisma.deal.groupBy({ by: ['stageId'], where: { tenantId }, _count: { stageId: true }, _sum: { value: true } }),
      this.prisma.deal.aggregate({
        where: { tenantId },
        _sum: { value: true },
        _count: { id: true },
      }),
    ]);

    return {
      total: totalDeals,
      totalValue: totalValue._sum.value?.toString() || '0',
      openCount: totalValue._count.id,
      byStage: byStage.map((s) => ({ stageId: s.stageId, count: s._count.stageId, value: s._sum.value?.toString() || '0' })),
    };
  }
}
