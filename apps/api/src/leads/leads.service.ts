/**
 * ZYRA — Leads Service (CRM Phase 3)
 * Business logic: leads CRUD, scoring, conversion, assignment
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface CreateLeadDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyId?: string;
  source?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface AssignLeadDto {
  userId: string;
}

export interface LeadFilter {
  status?: string;
  source?: string;
  assignedTo?: string;
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string, filter: LeadFilter) {
    const where: Record<string, unknown> = {};

    if (filter.status) where.status = filter.status;
    if (filter.source) where.source = filter.source;
    if (filter.assignedTo) where.assignedTo = filter.assignedTo;
    if (filter.search) {
      where.OR = [
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filter.page - 1) * filter.limit;
    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
          company: true,
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { leads, total, page: filter.page, limit: filter.limit, totalPages: Math.ceil(total / filter.limit) };
  }

  async findById(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        company: true,
        Activity: { orderBy: { createdAt: 'desc' }, take: 20 } as any,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(tenantId: string, dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        companyId: dto.companyId,
        source: dto.source,
        notes: dto.notes,
        metadata: dto.metadata as any,
        score: this.calculateScore(dto),
      } as any,
      include: {
        company: true,
        assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    this.eventBus.emit('lead.created', { leadId: lead.id, tenantId });
    return lead;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true, tenantId: true } });
    if (!lead) throw new NotFoundException('Lead not found');

    const updated = await this.prisma.lead.update({
      where: { id },
      data,
      include: {
        company: true,
        assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    this.eventBus.emit('lead.updated', { leadId: id, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.prisma.lead.delete({ where: { id } });
    this.eventBus.emit('lead.deleted', { leadId: id, tenantId });
    return { success: true };
  }

  async convertToCustomer(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');

    let customer;
    if (lead.email) {
      customer = await this.prisma.customer.findFirst({ where: { email: lead.email, tenantId } });
    }

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId,
          email: lead.email ?? `lead-${id}@unknown.local`,
          firstName: lead.firstName ?? '',
          lastName: lead.lastName ?? '',
          phone: lead.phone,
          source: lead.source,
          notes: lead.notes,
          metadata: { ...(lead.metadata as Record<string, unknown>), convertedFromLeadId: id },
        },
      });
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { status: 'WON' as any, metadata: { ...(lead.metadata as Record<string, unknown>), convertedToCustomerId: customer.id } },
      include: {
        company: true,
        assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    this.eventBus.emit('lead.converted', { leadId: id, customerId: customer.id, tenantId });
    return updated;
  }

  async assign(id: string, tenantId: string, dto: AssignLeadDto) {
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');

    const user = await this.prisma.user.findFirst({ where: { id: dto.userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { assignedTo: dto.userId },
      include: {
        assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        company: true,
      },
    });

    this.eventBus.emit('lead.assigned', { leadId: id, userId: dto.userId, tenantId });
    return updated;
  }

  async bulkImport(tenantId: string, csv: string) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map((v) => v.trim());
      try {
        const data: Record<string, unknown> = { tenantId, source: 'import' };
        headers.forEach((h, idx) => { if (values[idx]) data[h] = values[idx]; });
        await this.prisma.lead.create({ data: data as any });
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${(err as Error).message}`);
      }
    }

    this.eventBus.emit('lead.imported', { tenantId, success: results.success, failed: results.failed });
    return results;
  }

  async getStats(tenantId: string) {
    const [totalLeads, statusCounts, sourceCounts] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: { tenantId },
        _count: { source: true },
      }),
    ]);

    return {
      total: totalLeads,
      byStatus: statusCounts.reduce((acc, r) => { acc[r.status] = r._count.status; return acc; }, {} as Record<string, number>),
      bySource: sourceCounts.reduce((acc, r) => { acc[r.source || 'unknown'] = r._count.source; return acc; }, {} as Record<string, number>),
    };
  }

  private calculateScore(dto: CreateLeadDto): number {
    let score = 0;
    if (dto.email) score += 10;
    if (dto.phone) score += 10;
    if (dto.source) score += 5;
    if (dto.companyId) score += 15;
    if (dto.metadata && Object.keys(dto.metadata).length > 0) score += 5;
    return Math.min(score, 100);
  }
}
