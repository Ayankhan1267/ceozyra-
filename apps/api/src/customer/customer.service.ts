/**
 * ZYRA — Customer Service (CRM: Leads, Contacts, 360 View)
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreateCustomerDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId: string;
  tags?: string[];
  source?: string;
  notes?: string;
}

export interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lifetimeValue: number;
  segment: string;
  purchaseFrequency: {
    ordersPerMonth: number;
    avgDaysBetweenOrders: number | null;
  };
  customerSegments: { id: string; name: string; description?: string }[];
  recentActivity: {
    id: string;
    type: string;
    subject: string;
    description?: string;
    createdAt: string;
  }[];
}

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where: { tenantId } }),
    ]);
    return { customers, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { orders: { include: { items: true } } },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async get360View(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const [orders, orderCount, totalSpentAgg, avgOrderValueAgg] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: id },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { customerId: id } }),
      this.prisma.order.aggregate({
        where: { customerId: id, status: 'COMPLETED' },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { customerId: id, status: 'COMPLETED' },
        _avg: { total: true },
      }),
    ]);

    const ltv = Number(totalSpentAgg._sum.total) || 0;
    const aov = Number(avgOrderValueAgg._avg.total) || 0;

    // ── Segment from LTV thresholds ─────────────────────────────────────────────
    let segment = 'new';
    if (ltv > 10000) segment = 'vip';
    else if (ltv > 5000) segment = 'loyal';
    else if (ltv > 1000) segment = 'regular';
    else if (orderCount > 0) segment = 'repeat';

    // ── Purchase frequency ──────────────────────────────────────────────────────
    const sortedOrders = orders
      .filter((o) => o.status === 'COMPLETED')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let ordersPerMonth = 0;
    let avgDaysBetweenOrders: number | null = null;

    if (sortedOrders.length >= 2) {
      const firstDate = new Date(sortedOrders[0].createdAt).getTime();
      const lastDate = new Date(sortedOrders[sortedOrders.length - 1].createdAt).getTime();
      const daysSpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
      const monthsSpan = daysSpan / 30;
      ordersPerMonth = monthsSpan > 0 ? Number((sortedOrders.length / monthsSpan).toFixed(1)) : 0;

      const gaps: number[] = [];
      for (let i = 1; i < sortedOrders.length; i++) {
        const diff =
          new Date(sortedOrders[i].createdAt).getTime() -
          new Date(sortedOrders[i - 1].createdAt).getTime();
        gaps.push(diff / (1000 * 60 * 60 * 24));
      }
      avgDaysBetweenOrders = Number(
        (gaps.reduce((s, g) => s + g, 0) / gaps.length).toFixed(1)
      );
    }

    // ── Customer segments (dynamic segments that include this customer) ─────────
    const matchedSegments = await this.prisma.segment.findMany({
      where: { customerIds: { has: id } },
      select: { id: true, name: true, description: true },
    });

    // ── Recent activity ────────────────────────────────────────────────────────
    const recentActivity = await this.prisma.activity.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        subject: true,
        description: true,
        createdAt: true,
      },
    });

    // ── Linked deals ───────────────────────────────────────────────────────────
    const deals = await this.prisma.deal.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        value: true,
        status: true,
        stageId: true,
        pipeline: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    return {
      ...customer,
      orders,
      deals,
      stats: {
        totalOrders: orderCount,
        totalSpent: ltv,
        avgOrderValue: aov,
        lifetimeValue: ltv,
        segment,
        purchaseFrequency: {
          ordersPerMonth,
          avgDaysBetweenOrders,
        },
        customerSegments: matchedSegments,
        recentActivity,
      } satisfies CustomerStats,
    };
  }

  async create(dto: CreateCustomerDto) {
    const { tags, ...data } = dto;
    const customer = await this.prisma.customer.create({
      data: {
        ...data,
        tags: tags || [],
      },
    });
    return customer;
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }

  async updateSegment(id: string, segment: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { segment: segment as any },
    });
  }
}
