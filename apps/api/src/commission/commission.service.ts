/**
 * ZYRA — Commission Service
 * Handles partner and head commissions with assignment tracking
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CommissionCalculation {
  orderId: string;
  orderTotal: number;
  partnerRate: number;
  headRate: number;
  partnerShare: number;
  headShare: number;
  partnerUserId: string;
  headUserId: string;
  tenantId: string;
}

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateCommissions(dto: CommissionCalculation) {
    const commission = await this.prisma.commission.create({
      data: {
        orderId: dto.orderId,
        amount: dto.orderTotal,
        partnerRate: dto.partnerRate,
        headRate: dto.headRate,
        headShare: dto.headShare,
        partnerShare: dto.partnerShare,
        headUserId: dto.headUserId,
        partnerUserId: dto.partnerUserId,
        tenantId: dto.tenantId,
        status: 'PENDING',
      },
    });
    return commission;
  }

  async getByPartner(partnerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [commissions, total, approved, paid] = await Promise.all([
      this.prisma.commission.findMany({
        where: { partnerUserId: partnerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commission.count({ where: { partnerUserId: partnerId } }),
      this.prisma.commission.aggregate({
        where: { partnerUserId: partnerId, status: 'APPROVED' },
        _sum: { partnerShare: true },
      }),
      this.prisma.commission.aggregate({
        where: { partnerUserId: partnerId, status: 'PAID' },
        _sum: { partnerShare: true },
      }),
    ]);

    return {
      commissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalEarned: Number(approved._sum.partnerShare) || 0,
        totalPaid: Number(paid._sum.partnerShare) || 0,
        pendingAmount: (Number(approved._sum.partnerShare) || 0) - (Number(paid._sum.partnerShare) || 0),
      },
    };
  }

  async getByHead(headId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [commissions, total, paid] = await Promise.all([
      this.prisma.commission.findMany({
        where: { headUserId: headId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commission.count({ where: { headUserId: headId } }),
      this.prisma.commission.aggregate({
        where: { headUserId: headId, status: 'PAID' },
        _sum: { headShare: true },
      }),
    ]);

    return {
      commissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalEarned: commissions.reduce((s, c) => s + Number(c.headShare), 0),
        totalPaid: Number(paid._sum.headShare) || 0,
      },
    };
  }

  async getByTenant(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [commissions, total, totalPaid] = await Promise.all([
      this.prisma.commission.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commission.count({ where: { tenantId } }),
      this.prisma.commission.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { partnerShare: true, headShare: true },
      }),
    ]);

    return {
      commissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalPaid: (Number(totalPaid._sum.partnerShare) || 0) + (Number(totalPaid._sum.headShare) || 0),
    };
  }

  async approve(id: string) {
    return this.prisma.commission.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() as any },
    });
  }

  async markPaid(id: string) {
    return this.prisma.commission.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() as any },
    });
  }

  async reject(id: string) {
    return this.prisma.commission.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }
}
