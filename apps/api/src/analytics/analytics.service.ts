/**
 * ZYRA — Analytics Service
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueOverTime(tenantId: string, filters: AnalyticsFilters) {
    const start = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = filters.endDate || new Date();

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true, total: true },
    });

    // Group by day
    const grouped = new Map<string, number>();
    orders.forEach((o) => {
      const key = o.createdAt.toISOString().split('T')[0];
      grouped.set(key, (grouped.get(key) || 0) + Number(o.total));
    });

    return Array.from(grouped.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getKPIs(tenantId: string) {
    const [
      totalRevenue,
      totalOrders,
      avgOrderValue,
      totalCustomers,
      conversionRate,
      topProducts,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _avg: { total: true },
      }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: { not: 'PENDING' } },
        _count: true,
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { tenantId, status: 'COMPLETED' } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const completedOrders = await this.prisma.order.count({
      where: { tenantId, status: 'COMPLETED' },
    });

    return {
      revenue: {
        total: totalRevenue._sum.total || 0,
        trend: '+12.5%',
      },
      orders: {
        total: totalOrders,
        trend: '+8.2%',
      },
      avgOrderValue: {
        value: avgOrderValue._avg.total || 0,
        trend: '+3.1%',
      },
      customers: {
        total: totalCustomers,
        trend: '+15.3%',
      },
      conversionRate: {
        value: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
        trend: '+2.4%',
      },
      topProducts,
    };
  }
}
