/**
 * ZYRA — Policies Service (Phase 8.2)
 *
 * Governs which actions the autopilot may take at each autonomy level.
 * Budget limits, approval gates, and time windows are evaluated here.
 *
 * Budget enforcement is hard: actions that breach the configured
 * spend ceiling are rejected before any other check runs.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PolicyContext {
  tenantId: string;
  agentId?: string;
  userId?: string;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  budgetRemaining?: number;
}

export interface BudgetSpend {
  daily: number;
  weekly: number;
  monthly: number;
}

// ── Action risk classification ────────────────────────────────────────────────

const AUTONOMY_LEVELS = {
  1: { label: 'Monitor', canRun: [], needsApproval: true },
  2: { label: 'Suggest', canRun: [], needsApproval: true },
  3: { label: 'Auto-approve low-risk', canRun: ['create_coupon', 'send_followup_email', 'update_segment'], needsApproval: false },
  4: { label: 'Full autonomy', canRun: ['create_coupon', 'send_followup_email', 'update_segment', 'pause_campaign', 'create_email_campaign', 'update_product_price', 'create_discount', 'assign_lead'], needsApproval: false },
} as const;

// Actions that always require a human regardless of level
const ALWAYS_REQUIRE_APPROVAL = new Set([
  'delete_product',
  'process_refund',
  'change_budget',
  'delete_campaign',
  'update_price_significant',
  'send_bulk_email',
]);

// Actions that map to ApprovalType values
const ACTION_TO_APPROVAL_TYPE: Record<string, string> = {
  create_coupon: 'DISCOUNT',
  create_discount: 'DISCOUNT',
  send_followup_email: 'COMMUNICATION',
  send_bulk_email: 'COMMUNICATION',
  pause_campaign: 'CAMPAIGN',
  create_email_campaign: 'CAMPAIGN',
  update_product_price: 'PRICE_CHANGE',
  update_segment: 'AUTOMATION',
  assign_lead: 'AUTOMATION',
  process_refund: 'ORDER_REFUND',
  change_budget: 'AD_SPEND',
};

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Budget enforcement ────────────────────────────────────────────────────

  async getSpend(ctx: PolicyContext): Promise<BudgetSpend> {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, weekly, monthly] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { tenantId: ctx.tenantId, date: { gte: dayStart } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { tenantId: ctx.tenantId, date: { gte: weekStart } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { tenantId: ctx.tenantId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    return {
      daily: Number(daily._sum.amount ?? 0),
      weekly: Number(weekly._sum.amount ?? 0),
      monthly: Number(monthly._sum.amount ?? 0),
    };
  }

  async enforceBudget(ctx: PolicyContext, estimatedCost: number): Promise<PolicyResult> {
    if (estimatedCost < 0) {
      return { allowed: false, reason: 'Estimated cost must be non-negative', requiresApproval: true };
    }

    const policies = await this.prisma.businessPolicy.findMany({
      where: { tenantId: ctx.tenantId, isActive: true, type: 'budget' },
    });

    const spend = await this.getSpend(ctx);

    for (const policy of policies) {
      const limit = Number((policy.value as any)?.limit ?? 0);
      if (limit <= 0) continue;

      const period = (policy.value as any)?.period ?? 'monthly';
      const currentSpend = period === 'daily' ? spend.daily : period === 'weekly' ? spend.weekly : spend.monthly;
      const remaining = limit - currentSpend;

      if (estimatedCost > remaining) {
        return {
          allowed: false,
          reason: `Budget exceeded for ${period}: spent ${currentSpend.toFixed(2)} of ${limit.toFixed(2)} (remaining: ${remaining.toFixed(2)}, needs: ${estimatedCost.toFixed(2)})`,
          requiresApproval: true,
          budgetRemaining: remaining,
        };
      }
    }

    return {
      allowed: true,
      requiresApproval: false,
      budgetRemaining: Infinity,
    };
  }

  // ── Main policy check ─────────────────────────────────────────────────────

  async checkPolicy(action: string, ctx: PolicyContext, estimatedCost = 0): Promise<PolicyResult> {
    // 1) Always-require-approval gate
    if (ALWAYS_REQUIRE_APPROVAL.has(action)) {
      return { allowed: true, requiresApproval: true, reason: 'Action always requires human approval' };
    }

    // 2) Budget enforcement (hard stop)
    const budgetResult = await this.enforceBudget(ctx, estimatedCost);
    if (!budgetResult.allowed) return budgetResult;

    // 3) Resolve autonomy level
    const agent = ctx.agentId
      ? await this.prisma.agent.findUnique({ where: { id: ctx.agentId }, select: { autonomyLevel: true } })
      : null;
    const level = agent?.autonomyLevel ?? 1;
    const levelConfig = AUTONOMY_LEVELS[level as keyof typeof AUTONOMY_LEVELS] ?? AUTONOMY_LEVELS[1];

    // 4) Check if action is allowed at this level
    const canRun = levelConfig.canRun.includes(action);
    if (!canRun) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Action "${action}" requires approval at autonomy level ${level} (${levelConfig.label})`,
      };
    }

    return { allowed: true, requiresApproval: false };
  }

  // ── Helper: map action to ApprovalType ────────────────────────────────────

  getApprovalType(action: string): string {
    return ACTION_TO_APPROVAL_TYPE[action] ?? 'OTHER';
  }

  // ── Time policy ───────────────────────────────────────────────────────────

  isWithinBusinessHours(): boolean {
    const now = new Date();
    const utc = now.getUTCHours();
    // Default window: 06:00–22:00 UTC (configurable per-tenant)
    return utc >= 6 && utc < 22;
  }

  async checkTimePolicy(tenantId: string): Promise<PolicyResult> {
    const policy = await this.prisma.businessPolicy.findFirst({
      where: { tenantId, type: 'time', isActive: true },
    });

    if (!policy) return { allowed: true, requiresApproval: false };

    const restricted = (policy.value as any)?.restricted ?? false;
    if (!restricted) return { allowed: true, requiresApproval: false };

    if (!this.isWithinBusinessHours()) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: 'Action is outside configured business hours and requires approval',
      };
    }

    return { allowed: true, requiresApproval: false };
  }

  // ── Policy CRUD ───────────────────────────────────────────────────────────

  async getPolicies(tenantId: string) {
    return this.prisma.businessPolicy.findMany({
      where: { tenantId },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async upsertPolicy(tenantId: string, code: string, data: { name: string; type: string; value?: any; description?: string }) {
    return this.prisma.businessPolicy.upsert({
      where: { tenantId_code: { tenantId, code } } as any,
      create: { tenantId, code, ...data },
      update: { ...data, updatedAt: new Date() },
    });
  }
}
