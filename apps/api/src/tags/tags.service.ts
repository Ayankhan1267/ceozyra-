/**
 * ZYRA — Tags Service
 * CRUD + bulk tagging for customers.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreateTagDto {
  tenantId: string;
  name: string;
  color?: string;
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateTagDto) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    if (!dto.name) throw new BadRequestException('name is required');
    return this.prisma.tag.create({ data: { tenantId: dto.tenantId, name: dto.name, color: dto.color } });
  }

  async update(id: string, dto: Record<string, unknown>, tenantId: string) {
    const existing = await this.prisma.tag.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Tag not found');
    return this.prisma.tag.update({ where: { id }, data: dto });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.tag.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
    return { success: true };
  }

  async bulkTag(tenantId: string, customerIds: string[], tagNames: string[], action: 'add' | 'remove') {
    const results: { customerId: string; tags: string[] }[] = [];

    for (const customerId of customerIds) {
      const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, tags: true } });
      if (!customer) continue;

      const currentTags = [...(customer.tags || [])];
      for (const tagName of tagNames) {
        if (action === 'add' && !currentTags.includes(tagName)) {
          currentTags.push(tagName);
        } else if (action === 'remove') {
          const idx = currentTags.indexOf(tagName);
          if (idx >= 0) currentTags.splice(idx, 1);
        }
      }

      const updated = await this.prisma.customer.update({
        where: { id: customerId },
        data: { tags: currentTags },
        select: { id: true, tags: true },
      });
      results.push({ customerId: updated.id, tags: updated.tags });
    }

    return { tagged: results.length, results };
  }
}
