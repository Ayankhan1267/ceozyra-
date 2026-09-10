/**
 * ZYRA — Tenant Service
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  async findById(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  async create(data: { name: string; slug: string; domain?: string; customDomain?: string }) {
    return this.prisma.tenant.create({
      data: { ...data, status: 'TRIAL', plan: 'STARTER' },
    });
  }

  async findAll(options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.tenant.count(),
    ]);

    return { tenants, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.tenant.delete({ where: { id } });
  }
}
