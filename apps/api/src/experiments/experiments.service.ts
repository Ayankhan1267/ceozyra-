/**
 * ZYRA — Experiments Service (Phase 7.2)
 * A/B testing framework: create, run, record, and analyze experiments.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import type { ExperimentType, ExperimentStatus } from '@prisma/client';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateExperimentDto {
  tenantId: string;
  name: string;
  description?: string;
  type: ExperimentType;
  hypothesis?: string;
  goal?: string;
  successMetric?: string;
  variants: Array<{
    name: string;
    description?: string;
    config?: Record<string, unknown>;
    isControl?: boolean;
    allocation?: number;
  }>;
}

export interface RecordResultDto {
  experimentId: string;
  variantId: string;
  metric: 'conversion_rate' | 'revenue_per_visitor' | 'add_to_cart_rate';
  value: number;
  sampleSize?: number;
}

export interface ExperimentStats {
  total: number;
  running: number;
  completed: number;
  draft: number;
  byType: Record<string, number>;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ExperimentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async create(dto: CreateExperimentDto) {
    if (dto.variants.length < 2) {
      throw new BadRequestException('At least 2 variants are required');
    }

    const totalAllocation = dto.variants.reduce((sum, v) => sum + (v.allocation ?? 50), 0);
    if (totalAllocation !== 100) {
      throw new BadRequestException('Variant allocations must sum to 100');
    }

    const experiment = await this.prisma.experiment.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        hypothesis: dto.hypothesis,
        goal: dto.goal,
        successMetric: dto.successMetric || 'conversion_rate',
        variants: {
          create: dto.variants.map((v) => ({
            name: v.name,
            description: v.description,
            config: v.config,
            isControl: v.isControl ?? false,
            allocation: v.allocation ?? 50,
          })),
        },
      },
      include: { variants: true, results: true },
    });

    this.eventService.emit('experiment.created', { experimentId: experiment.id, tenantId: dto.tenantId });
    return experiment;
  }

  async list(tenantId: string, status?: ExperimentStatus, type?: ExperimentType) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (type) where.type = type;

    return this.prisma.experiment.findMany({
      where,
      include: {
        variants: { orderBy: { createdAt: 'asc' } },
        results: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const experiment = await this.prisma.experiment.findFirst({
      where: { id, tenantId },
      include: {
        variants: { orderBy: { createdAt: 'asc' }, include: { results: true } },
        results: { orderBy: { computedAt: 'desc' } },
      },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    return experiment;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async startExperiment(id: string, tenantId: string) {
    const experiment = await this.findById(id, tenantId);
    if (experiment.status === 'RUNNING') {
      throw new BadRequestException('Experiment is already running');
    }
    if (experiment.status === 'COMPLETED') {
      throw new BadRequestException('Cannot restart a completed experiment');
    }
    if (experiment.variants.length < 2) {
      throw new BadRequestException('Experiment must have at least 2 variants');
    }

    const now = new Date();
    const updated = await this.prisma.experiment.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startAt: now,
        endAt: null,
        winner: null,
      },
      include: { variants: true },
    });

    this.eventService.emit('experiment.started', { experimentId: id, tenantId, startedAt: now });
    return updated;
  }

  async stopExperiment(id: string, tenantId: string) {
    const experiment = await this.findById(id, tenantId);
    if (experiment.status !== 'RUNNING') {
      throw new BadRequestException('Only running experiments can be stopped');
    }

    const winner = await this._calculateWinner(id);

    const now = new Date();
    const updated = await this.prisma.experiment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endAt: now,
        winner: winner?.variantId || null,
      },
      include: { variants: true, results: true },
    });

    this.eventService.emit('experiment.completed', {
      experimentId: id,
      tenantId,
      winner: winner?.variantId,
      completedAt: now,
    });

    return updated;
  }

  // ── Results ──────────────────────────────────────────────────────────────────

  async recordResult(dto: RecordResultDto) {
    const experiment = await this.prisma.experiment.findFirst({
      where: { id: dto.experimentId },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    if (experiment.status !== 'RUNNING') {
      throw new BadRequestException('Can only record results for running experiments');
    }

    const variant = await this.prisma.experimentVariant.findFirst({
      where: { id: dto.variantId, experimentId: dto.experimentId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const result = await this.prisma.experimentResult.create({
      data: {
        experimentId: dto.experimentId,
        variantId: dto.variantId,
        metric: dto.metric,
        value: dto.value,
        sampleSize: dto.sampleSize,
      },
    });

    this.eventService.emit('experiment.result_recorded', {
      experimentId: dto.experimentId,
      variantId: dto.variantId,
      metric: dto.metric,
      value: dto.value,
    });

    return result;
  }

  async getExperimentResults(id: string, tenantId: string) {
    await this.findById(id, tenantId);

    const results = await this.prisma.experimentResult.findMany({
      where: { experimentId: id },
      include: { variant: { select: { id: true, name: true, isControl: true } } },
      orderBy: { computedAt: 'desc' },
    });

    // Aggregate by variant and metric
    const aggregated = new Map<string, { variantId: string; variantName: string; isControl: boolean; metric: string; value: number; sampleSize: number; computedAt: string }[]>();
    for (const r of results) {
      const key = `${r.variantId}-${r.metric}`;
      if (!aggregated.has(key)) {
        aggregated.set(key, []);
      }
      aggregated.get(key)!.push({
        variantId: r.variantId,
        variantName: r.variant.name,
        isControl: r.variant.isControl,
        metric: r.metric,
        value: r.value,
        sampleSize: r.sampleSize || 0,
        computedAt: r.computedAt.toISOString(),
      });
    }

    return Array.from(aggregated.values());
  }

  async getExperimentStats(tenantId: string): Promise<ExperimentStats> {
    const [total, running, completed, draft, experiments] = await Promise.all([
      this.prisma.experiment.count({ where: { tenantId } }),
      this.prisma.experiment.count({ where: { tenantId, status: 'RUNNING' } }),
      this.prisma.experiment.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.experiment.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.experiment.findMany({ where: { tenantId }, select: { type: true } }),
    ]);

    const byType: Record<string, number> = {};
    for (const e of experiments) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }

    return { total, running, completed, draft, byType };
  }

  // ── Winner Calculation ────────────────────────────────────────────────────────

  private async _calculateWinner(
    experimentId: string,
  ): Promise<{ variantId: string; confidence: number } | null> {
    const variants = await this.prisma.experimentVariant.findMany({
      where: { experimentId },
      include: { results: true },
    });

    if (variants.length < 2) return null;

    // Find the variant with the highest conversion_rate value
    let best: { variantId: string; score: number; sampleSize: number } | null = null;

    for (const variant of variants) {
      const conversionResult = variant.results.find((r) => r.metric === 'conversion_rate');
      const revenueResult = variant.results.find((r) => r.metric === 'revenue_per_visitor');
      const atcResult = variant.results.find((r) => r.metric === 'add_to_cart_rate');

      let score = 0;
      if (conversionResult) score += conversionResult.value * 0.5;
      if (revenueResult) score += revenueResult.value * 0.3;
      if (atcResult) score += atcResult.value * 0.2;

      const totalSample = variant.results.reduce((sum, r) => sum + (r.sampleSize || 0), 0);

      if (!best || score > best.score) {
        best = { variantId: variant.id, score, sampleSize: totalSample };
      }
    }

    if (!best) return null;

    // Simple confidence: higher sample size = higher confidence
    const confidence = Math.min(95, 50 + (best.sampleSize / 100) * 10);

    // Update experiment winner
    await this.prisma.experiment.update({
      where: { id: experimentId },
      data: { winner: best.variantId },
    });

    return { variantId: best.variantId, confidence: Math.round(confidence) };
  }

  async calculateWinner(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this._calculateWinner(id);
  }
}
