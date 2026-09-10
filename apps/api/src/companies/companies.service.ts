/**
 * ZYRA — Companies Service (CRM Phase 3)
 * Business logic for companies CRUD
 */

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface CreateCompanyDto {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CompanyFilter {
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string, filter: CompanyFilter) {
    const where: Record<string, unknown> = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { domain: { contains: filter.search, mode: 'insensitive' } },
        { industry: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filter.page - 1) * filter.limit;
    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { leads: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { companies, total, page: filter.page, limit: filter.limit, totalPages: Math.ceil(total / filter.limit) };
  }

  async findById(id: string, tenantId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, tenantId },
      include: {
        leads: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async create(tenantId: string, dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: { ...dto, tenantId } as any,
      include: {
        _count: { select: { leads: true } },
      },
    });

    this.eventBus.emit('company.created', { companyId: company.id, tenantId });
    return company;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const company = await this.prisma.company.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!company) throw new NotFoundException('Company not found');

    const updated = await this.prisma.company.update({
      where: { id },
      data,
      include: {
        _count: { select: { leads: true } },
      },
    });

    this.eventBus.emit('company.updated', { companyId: id, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const company = await this.prisma.company.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!company) throw new NotFoundException('Company not found');

    await this.prisma.company.delete({ where: { id } });
    this.eventBus.emit('company.deleted', { companyId: id, tenantId });
    return { success: true };
  }
}
