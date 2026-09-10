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

    const [orders, orderCount, totalSpent, avgOrderValue] = await Promise.all([
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

    const ltv = Number(totalSpent._sum.total) || 0;
    const aov = Number(avgOrderValue._avg.total) || 0;

    // Calculate segment
    let segment = 'new';
    if (ltv > 10000) segment = 'vip';
    else if (ltv > 5000) segment = 'loyal';
    else if (ltv > 1000) segment = 'regular';
    else if (orderCount > 0) segment = 'repeat';

    return {
      ...customer,
      orders,
      stats: {
        totalOrders: orderCount,
        totalSpent: ltv,
        avgOrderValue: aov,
        lifetimeValue: ltv,
        segment,
      },
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
