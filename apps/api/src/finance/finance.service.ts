/**
 * ZYRA — Finance Service
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface PnLData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  margin: number;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getPnL(tenantId: string, startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const completedOrders = await this.prisma.order.findMany({
      where: { tenantId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      include: { items: true },
    });

    let revenue = 0;
    let cogs = 0;

    for (const order of completedOrders) {
      revenue += Number(order.total);
      for (const item of order.items) {
        cogs += Number(item.quantity) * Number(item.unitPrice) * 0.6;
      }
    }

    const grossProfit = revenue - cogs;
    const expenses = 0;
    const netProfit = grossProfit - expenses;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      margin: Math.round(margin * 100) / 100,
      period: { start, end },
    };
  }

  async getMetrics(tenantId: string) {
    const [
      revenueResult,
      ordersCount,
      avgOrderResult,
      customersCount,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _avg: { total: true },
      }),
      this.prisma.customer.count({ where: { tenantId } }),
    ]);

    const totalRevenue = Number(revenueResult._sum.total) || 0;
    const avgOrder = Number(avgOrderResult._avg.total) || 0;

    return {
      revenue: totalRevenue,
      orders: ordersCount,
      avgOrderValue: avgOrder,
      customers: customersCount,
      cac: 0,
      ltv: customersCount > 0 ? totalRevenue / customersCount : 0,
      roas: 0,
      grossMargin: 0,
    };
  }
}
