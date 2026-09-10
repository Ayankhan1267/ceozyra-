/**
 * ZYRA — Pipeline Service
 * CRUD for Pipelines with stages management.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreatePipelineDto {
  tenantId: string;
  name: string;
  description?: string;
  stages: Array<{ id: string; name: string; order: number }>;
  isDefault?: boolean;
}

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.pipeline.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id, tenantId } });
    if (!pipeline) throw new BadRequestException('Pipeline not found');
    return pipeline;
  }

  async create(dto: CreatePipelineDto) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    if (!dto.name) throw new BadRequestException('name is required');

    if (dto.isDefault) {
      await this.prisma.pipeline.updateMany({
        where: { tenantId: dto.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.pipeline.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        description: dto.description,
        stages: dto.stages,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(id: string, dto: Record<string, unknown>, tenantId: string) {
    const existing = await this.prisma.pipeline.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Pipeline not found');

    if (dto.isDefault === true) {
      await this.prisma.pipeline.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.pipeline.update({ where: { id }, data: dto });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.pipeline.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Pipeline not found');
    await this.prisma.pipeline.delete({ where: { id } });
    return { success: true };
  }
}
