/**
 * ZYRA — CRM Service
 * Aggregated queries combining leads, deals, activities, and pipeline data.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const [leadStats, dealStats, recentActivities, pipelines, openDeals, totalCustomers] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      this.prisma.deal.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
        _sum: { value: true },
      }),
      this.prisma.activity.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.pipeline.findMany({
        where: { tenantId },
        include: { _count: { select: { deals: true } } },
      }),
      this.prisma.deal.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.customer.count({ where: { tenantId } }),
    ]);

    const totalLeads = leadStats.reduce((sum, s) => sum + s._count.status, 0);
    const totalDeals = dealStats.reduce((sum, s) => sum + s._count.status, 0);
    const totalDealValue = dealStats.reduce((sum, s) => sum + Number(s._sum.value || 0), 0);

    return {
      summary: {
        totalLeads,
        totalCustomers,
        totalDeals,
        openDeals,
        totalDealValue: totalDealValue.toFixed(2),
      },
      leadStats: leadStats.map((s) => ({ status: s.status, count: s._count.status })),
      dealStats: dealStats.map((s) => ({ status: s.status, count: s._count.status, value: s._sum.value?.toString() || '0' })),
      recentActivities,
      pipelines: pipelines.map((p) => ({ ...p, dealCount: (p as any)._count?.deals || 0 })),
    };
  }

  async getInsights(tenantId: string) {
    const [topLeads, segments, recentDeals] = await Promise.all([
      this.prisma.lead.findMany({
        where: { tenantId },
        orderBy: { score: 'desc' },
        take: 10,
        include: { company: true },
      }),
      this.prisma.segment.findMany({
        where: { tenantId },
        select: { id: true, name: true, customerIds: true, isDynamic: true },
      }),
      this.prisma.deal.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
    ]);

    return {
      topLeads,
      segments: segments.map((s) => ({ ...s, customerCount: s.customerIds.length })),
      recentDeals,
    };
  }
}
