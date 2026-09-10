/**
 * ZYRA — Activities Service
 * CRUD for Activities with tenant isolation.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreateActivityDto {
  tenantId: string;
  type: string;
  subject: string;
  description?: string;
  customerId?: string;
  leadId?: string;
  dealId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, string | undefined>) {
    const tenantId = query.tenantId;
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const where: any = { tenantId };
    if (query.customerId) where.customerId = query.customerId;
    if (query.leadId) where.leadId = query.leadId;
    if (query.type) where.type = query.type;

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, email: true, firstName: true, lastName: true } }, lead: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { activities, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateActivityDto) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    return this.prisma.activity.create({
      data: {
        tenantId: dto.tenantId,
        type: dto.type as any,
        subject: dto.subject,
        description: dto.description,
        customerId: dto.customerId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        userId: dto.userId,
        metadata: dto.metadata as any,
      },
    });
  }

  async update(id: string, dto: Record<string, unknown>, tenantId: string) {
    const existing = await this.prisma.activity.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Activity not found');
    return this.prisma.activity.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.activity.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Activity not found');
    await this.prisma.activity.delete({ where: { id } });
    return { success: true };
  }
}
