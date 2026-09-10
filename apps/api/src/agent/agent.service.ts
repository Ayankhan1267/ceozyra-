/**
 * ZYRA — Agent Service
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

export interface CreateAgentRunDto {
  agentType: string;
  input: Record<string, unknown>;
  tenantId: string;
  userId: string;
  context?: Record<string, unknown>;
}

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async getByTenant(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [runs, total] = await Promise.all([
      this.prisma.agentRun.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agentRun.count({ where: { tenantId } }),
    ]);
    return { runs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
      include: { agent: true },
    });
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }

  async create(dto: CreateAgentRunDto) {
    const run = await this.prisma.agentRun.create({
      data: {
        agentType: dto.agentType,
        input: dto.input as any,
        context: dto.context as any,
        tenantId: dto.tenantId,
        userId: dto.userId,
        status: 'PENDING',
      },
      include: { agent: true },
    });

    await this.queueService.addAiJob('agent-run', {
      runId: run.id,
      agentType: dto.agentType,
      input: dto.input,
      tenantId: dto.tenantId,
    });

    return run;
  }

  async updateStatus(id: string, status: string, output?: Record<string, unknown>) {
    const updateData: Record<string, unknown> = { status: status as any };
    if (output) updateData.output = output;
    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
    }
    return this.prisma.agentRun.update({
      where: { id },
      data: updateData,
    });
  }

  async getAgents(tenantId: string) {
    return this.prisma.agent.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getDashboardData(tenantId: string) {
    const [
      totalRuns,
      completedRuns,
      pendingRuns,
      failedRuns,
      recentRuns,
    ] = await Promise.all([
      this.prisma.agentRun.count({ where: { tenantId } }),
      this.prisma.agentRun.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.agentRun.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.agentRun.count({ where: { tenantId, status: 'FAILED' } }),
      this.prisma.agentRun.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      stats: {
        totalRuns,
        completedRuns,
        pendingRuns,
        failedRuns,
        successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
      },
      recentRuns,
    };
  }
}
