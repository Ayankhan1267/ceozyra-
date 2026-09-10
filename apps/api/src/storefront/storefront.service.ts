/**
 * ZYRA — Storefront Service
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreateStorefrontDto {
  name: string;
  slug: string;
  tenantId: string;
  domain?: string;
  customDomain?: string;
  theme?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
}

@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const sf = await this.prisma.storefront.findFirst({
      where: { slug },
      include: { tenant: true, products: { where: { isActive: true } } },
    });
    if (!sf) throw new NotFoundException('Storefront not found');
    return sf;
  }

  async findByTenant(tenantId: string) {
    return this.prisma.storefront.findMany({
      where: { tenantId },
    });
  }

  async findById(id: string) {
    const sf = await this.prisma.storefront.findUnique({
      where: { id },
      include: { tenant: true },
    });
    if (!sf) throw new NotFoundException('Storefront not found');
    return sf;
  }

  async create(dto: CreateStorefrontDto) {
    return this.prisma.storefront.create({
      data: dto as any,
      include: { tenant: true },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.storefront.update({
      where: { id },
      data,
      include: { tenant: true },
    });
  }

  async delete(id: string) {
    return this.prisma.storefront.delete({ where: { id } });
  }

  async getStorefrontData(slug: string) {
    const sf = await this.findBySlug(slug);
    const products = await this.prisma.product.findMany({
      where: { storefrontId: sf.id, isActive: true },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
    return { ...sf, products };
  }
}
