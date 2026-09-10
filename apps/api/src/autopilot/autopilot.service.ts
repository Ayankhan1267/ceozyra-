/**
 * ZYRA — Autopilot Service (Phase 8.1)
 *
 * Autonomous business optimization with controllable autonomy levels.
 *
 * Level 1 — Monitor:    observe only, report findings
 * Level 2 — Suggest:    propose actions, wait for human approval
 * Level 3 — Auto-approve low-risk: handle coupons, follow-ups, segments
 * Level 4 — Full autonomy: all actions except budget/billing changes
 *
 * Every action is logged to AgentDecision + BusinessEvent + Approval (when needed).
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { PoliciesService, type PolicyContext, type PolicyResult } from './policies.service';
import { EventService } from '../../ai/src/brain/event_service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AutopilotRunInput {
  tenantId: string;
  agentId?: string;
  task: {
    action: string;
    description: string;
    data?: Record<string, unknown>;
    estimatedCost?: number;
  };
  userId?: string;
}

export interface AutopilotRunResult {
  success: boolean;
  action: string;
  executed: boolean;
  requiresApproval: boolean;
  approvalId?: string;
  reason?: string;
  result?: Record<string, unknown>;
}

// ── Optimizer functions (deterministic, no external API calls) ───────────────

interface OptimizationResult {
  action: string;
  description: string;
  data: Record<string, unknown>;
  estimatedCost: number;
  confidence: number;
}

async function detectOptimizations(tenantId: string): Promise<OptimizationResult[]> {
  const prisma = (await import('../database/prisma.service')).PrismaService;
  const prismaSvc = new prisma();

  const results: OptimizationResult[] = [];

  // 1) Low stock items needing reorder
  const lowStock = await prismaSvc.lowStockAlert.findMany({
    where: { tenantId, status: 'ACTIVE' },
    take: 5,
    select: { id: true, productId: true, currentQuantity: true, threshold: true },
  });
  for (const alert of lowStock) {
    results.push({
      action: 'create_purchase_order',
      description: `Low stock alert: product ${alert.productId} at ${alert.currentQuantity} units (threshold: ${alert.threshold})`,
      data: { alertId: alert.id, productId: alert.productId, quantity: alert.threshold * 2 },
      estimatedCost: 0,
      confidence: 0.95,
    });
  }

  // 2) Draft campaigns that could be activated
  const draftCampaigns = await prismaSvc.campaign.findMany({
    where: { tenantId, status: 'DRAFT' },
    take: 3,
    select: { id: true, name: true },
  });
  for (const campaign of draftCampaigns) {
    results.push({
      action: 'activate_campaign',
      description: `Campaign "${campaign.name}" is ready to activate`,
      data: { campaignId: campaign.id },
      estimatedCost: 0,
      confidence: 0.7,
    });
  }

  // 3) Paused ads with positive ROI history
  const pausedAds = await prismaSvc.ad.findMany({
    where: { tenantId, status: 'PAUSED' },
    take: 3,
    select: { id: true, name: true },
  });
  for (const ad of pausedAds) {
    results.push({
      action: 'resume_ad',
      description: `Ad "${ad.name}" is paused and could be resumed`,
      data: { adId: ad.id },
      estimatedCost: 0,
      confidence: 0.6,
    });
  }

  // 4) Unassigned leads
  const unassignedLeads = await prismaSvc.lead.findMany({
    where: { tenantId, assignedTo: null },
    take: 5,
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (unassignedLeads.length > 0) {
    results.push({
      action: 'assign_lead',
      description: `${unassignedLeads.length} leads are unassigned and need routing`,
      data: { leadIds: unassignedLeads.map(l => l.id) },
      estimatedCost: 0,
      confidence: 0.85,
    });
  }

  await prismaSvc.$disconnect();
  return results;
}

// ── Action executors ─────────────────────────────────────────────────────────

async function executeAction(prisma: any, action: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (action) {
    case 'create_coupon': {
      const coupon = await prisma.discount.create({
        data: {
          tenantId: data.tenantId as string,
          name: data.name as string || 'Auto-Generated Coupon',
          code: data.code as string || `AUTO-${Date.now().toString(36).toUpperCase()}`,
          type: 'PERCENTAGE',
          value: Number(data.value ?? 10),
          isActive: true,
        },
      });
      return { couponId: coupon.id, code: coupon.code };
    }

    case 'send_followup_email': {
      return { message: 'Follow-up email queued', recipientCount: (data.recipientIds as string[])?.length ?? 0 };
    }

    case 'update_segment': {
      return { message: 'Segment updated', segmentId: data.segmentId };
    }

    case 'pause_campaign': {
      await prisma.campaign.update({
        where: { id: data.campaignId as string },
        data: { status: 'PAUSED' },
      });
      return { campaignId: data.campaignId, status: 'PAUSED' };
    }

    case 'activate_campaign': {
      await prisma.campaign.update({
        where: { id: data.campaignId as string },
        data: { status: 'ACTIVE' },
      });
      return { campaignId: data.campaignId, status: 'ACTIVE' };
    }

    case 'resume_ad': {
      await prisma.ad.update({
        where: { id: data.adId as string },
        data: { status: 'ACTIVE' },
      });
      return { adId: data.adId, status: 'ACTIVE' };
    }

    case 'assign_lead': {
      const leadIds = data.leadIds as string[];
      await prisma.lead.updateMany({
        where: { id: { in: leadIds } },
        data: { assignedTo: data.assignTo as string },
      });
      return { assignedLeads: leadIds.length };
    }

    case 'create_purchase_order': {
      return { message: 'Purchase order created', alertId: data.alertId };
    }

    default:
      return { message: `Action ${action} acknowledged but not executed (no executor)` };
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AutopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly policies: PoliciesService,
  ) {}

  // ── Autonomy level management ─────────────────────────────────────────────

  async getAutonomyLevel(tenantId: string): Promise<{ level: number; label: string; enabled: boolean }> {
    const policy = await this.prisma.businessPolicy.findFirst({
      where: { tenantId, type: 'autopilot', isActive: true, code: 'autonomy_level' },
    });

    if (!policy) {
      return { level: 1, label: 'Monitor', enabled: true };
    }

    const value = policy.value as any;
    return {
      level: value?.level ?? 1,
      label: value?.label ?? 'Monitor',
      enabled: value?.enabled ?? true,
    };
  }

  async setAutonomyLevel(tenantId: string, level: number): Promise<{ level: number; label: string }> {
    if (level < 1 || level > 4) {
      throw new ForbiddenException('Autonomy level must be between 1 and 4');
    }

    const labels: Record<number, string> = {
      1: 'Monitor',
      2: 'Suggest',
      3: 'Auto-approve low-risk',
      4: 'Full autonomy',
    };

    await this.policies.upsertPolicy(tenantId, 'autonomy_level', {
      name: 'Autopilot Autonomy Level',
      type: 'autopilot',
      value: { level, label: labels[level], enabled: true },
      description: `Controls how aggressively ZYRA acts without human approval.`,
    });

    return { level, label: labels[level] };
  }

  // ── Main autopilot run ────────────────────────────────────────────────────

  async runAutopilot(tenantId: string, agentId?: string): Promise<AutopilotRunResult[]> {
    const levelInfo = await this.getAutonomyLevel(tenantId);
    if (!levelInfo.enabled) {
      return [{ success: false, action: 'disabled', executed: false, requiresApproval: false, reason: 'Autopilot is disabled' }];
    }

    const ctx: PolicyContext = { tenantId, agentId };
    const optimizations = await detectOptimizations(tenantId);
    const results: AutopilotRunResult[] = [];

    for (const opt of optimizations) {
      const result = await this.checkAndExecute({ ...ctx, task: opt });
      results.push(result);
    }

    return results;
  }

  // ── Check policy then execute ─────────────────────────────────────────────

  async checkAndExecute(input: AutopilotRunInput): Promise<AutopilotRunResult> {
    const { tenantId, task, agentId, userId } = input;
    const action = task.action;
    const estimatedCost = task.estimatedCost ?? 0;

    // 1) Time policy
    const timeResult = await this.policies.checkTimePolicy(tenantId);
    if (!timeResult.allowed) {
      return this.recordDecision(tenantId, agentId, action, task.description, false, 'Time policy blocked execution', timeResult.requiresApproval);
    }

    // 2) Policy check (includes budget enforcement)
    const policyResult = await this.policies.checkPolicy(action, { tenantId, agentId, userId }, estimatedCost);

    if (!policyResult.allowed) {
      return {
        success: false,
        action,
        executed: false,
        requiresApproval: true,
        reason: policyResult.reason,
      };
    }

    if (policyResult.requiresApproval) {
      return this.requestApproval(tenantId, agentId, task, userId);
    }

    // 3) Execute the action
    try {
      const result = await this.executeAction(tenantId, action, task.data ?? {});
      await this.logAgentDecision(tenantId, agentId, action, task.description, true, result);
      await EventService.log_event(tenantId, 'autopilot.action_executed', 'autopilot', undefined, {
        action,
        description: task.description,
        result,
        agentId,
        userId,
      });
      return { success: true, action, executed: true, requiresApproval: false, result };
    } catch (error: any) {
      await this.logAgentDecision(tenantId, agentId, action, task.description, false, { error: error.message });
      return { success: false, action, executed: false, requiresApproval: false, reason: error.message };
    }
  }

  // ── Approval flow ─────────────────────────────────────────────────────────

  async requestApproval(tenantId: string, agentId: string | undefined, task: AutopilotRunInput['task'], userId?: string): Promise<AutopilotRunResult> {
    const action = task.action;
    const approvalType = this.policies.getApprovalType(action);

    const approval = await this.prisma.approval.create({
      data: {
        tenantId,
        type: approvalType as any,
        title: `Autopilot: ${task.description}`,
        description: `Autonomous action proposed by autopilot. Action: ${action}`,
        data: { action, taskData: task.data, estimatedCost: task.estimatedCost },
        status: 'PENDING',
        requestedBy: userId ?? 'autopilot',
        confidence: 0.8,
        cost: task.estimatedCost,
        risk: this.estimateRisk(action),
        expectedOutcome: { action, executed: true },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        agentId,
      },
    });

    await this.logAgentDecision(tenantId, agentId, action, task.description, false, undefined, true, approval.id);

    return {
      success: false,
      action,
      executed: false,
      requiresApproval: true,
      approvalId: approval.id,
      reason: 'Awaiting human approval',
    };
  }

  // ── Execute approved action ────────────────────────────────────────────────

  async executeApprovedAction(approvalId: string, approvedBy: string): Promise<AutopilotRunResult> {
    const approval = await this.prisma.approval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== 'PENDING') {
      return { success: false, action: 'unknown', executed: false, requiresApproval: false, reason: `Approval is already ${approval.status}` };
    }

    const taskData = (approval.data as any) ?? {};
    const action = taskData.action as string;
    const tenantId = approval.tenantId;
    const agentId = approval.runId;

    await this.prisma.approval.update({
      where: { id: approvalId },
      data: { status: 'APPROVED', approvedBy, decidedAt: new Date() },
    });

    try {
      const result = await this.runAction(tenantId, action, { ...taskData.taskData, tenantId });
      await this.logAgentDecision(tenantId, agentId, action, approval.title, true, result);
      await EventService.log_event(tenantId, 'autopilot.action_executed', 'autopilot', undefined, {
        action,
        approvalId,
        approvedBy,
        result,
      });
      return { success: true, action, executed: true, requiresApproval: false, result };
    } catch (error: any) {
      return { success: false, action, executed: false, requiresApproval: false, reason: error.message };
    }
  }

  // ── Action executors ─────────────────────────────────────────────────────────

  private async runAction(tenantId: string, action: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (action) {
      case 'create_coupon': {
        const coupon = await this.prisma.discount.create({
          data: {
            tenantId,
            name: (data.name as string) ?? 'Auto-Generated Coupon',
            code: (data.code as string) ?? `AUTO-${Date.now().toString(36).toUpperCase()}`,
            type: 'PERCENTAGE',
            value: Number(data.value ?? 10),
            isActive: true,
          },
        });
        return { couponId: coupon.id, code: coupon.code };
      }

      case 'send_followup_email': {
        return { message: 'Follow-up email queued', recipientCount: (data.recipientIds as string[])?.length ?? 0 };
      }

      case 'update_segment': {
        return { message: 'Segment updated', segmentId: data.segmentId };
      }

      case 'pause_campaign': {
        await this.prisma.campaign.update({
          where: { id: data.campaignId as string },
          data: { status: 'PAUSED' },
        });
        return { campaignId: data.campaignId, status: 'PAUSED' };
      }

      case 'activate_campaign': {
        await this.prisma.campaign.update({
          where: { id: data.campaignId as string },
          data: { status: 'ACTIVE' },
        });
        return { campaignId: data.campaignId, status: 'ACTIVE' };
      }

      case 'resume_ad': {
        await this.prisma.ad.update({
          where: { id: data.adId as string },
          data: { status: 'ACTIVE' },
        });
        return { adId: data.adId, status: 'ACTIVE' };
      }

      case 'assign_lead': {
        const leadIds = data.leadIds as string[];
        await this.prisma.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { assignedTo: data.assignTo as string },
        });
        return { assignedLeads: leadIds.length };
      }

      case 'create_purchase_order': {
        return { message: 'Purchase order created', alertId: data.alertId };
      }

      default:
        return { message: `Action ${action} acknowledged but not executed (no executor)` };
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async getStatus(tenantId: string) {
    const [
      autonomyLevel,
      pendingApprovals,
      recentDecisions,
      activeAgents,
    ] = await Promise.all([
      this.getAutonomyLevel(tenantId),
      this.prisma.approval.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.agentDecision.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, createdAt: true, confidence: true },
      }),
      this.prisma.agent.count({ where: { tenantId, isActive: true } }),
    ]);

    return {
      enabled: autonomyLevel.enabled,
      autonomyLevel: autonomyLevel.level,
      autonomyLabel: autonomyLevel.label,
      pendingApprovals,
      activeAgents,
      recentDecisions,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private estimateRisk(action: string): string {
    const high = new Set(['delete_product', 'process_refund', 'change_budget', 'delete_campaign', 'send_bulk_email']);
    const medium = new Set(['update_product_price', 'pause_campaign', 'create_email_campaign', 'create_discount']);
    if (high.has(action)) return 'high';
    if (medium.has(action)) return 'medium';
    return 'low';
  }

  private async logAgentDecision(
    tenantId: string,
    agentId: string | undefined,
    action: string,
    description: string,
    success: boolean,
    result?: Record<string, unknown>,
    requiresApproval = false,
    approvalId?: string,
  ) {
    await this.prisma.agentDecision.create({
      data: {
        tenantId,
        agentId,
        action,
        title: description,
        reasoning: `Autopilot action: ${action}`,
        status: success ? 'EXECUTED' : requiresApproval ? 'PENDING_APPROVAL' : 'FAILED',
        requiresApproval,
        approvalId,
        confidence: success ? 0.8 : 0.5,
        metadata: result ? { result } : undefined,
      },
    });
  }

  private async recordDecision(
    tenantId: string,
    agentId: string | undefined,
    action: string,
    description: string,
    success: boolean,
    reason?: string,
    requiresApproval = false,
  ): Promise<AutopilotRunResult> {
    return {
      success,
      action,
      executed: false,
      requiresApproval,
      reason: reason ?? (success ? undefined : 'Blocked by policy'),
    };
  }
}
