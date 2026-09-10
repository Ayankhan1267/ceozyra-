/**
 * ZYRA — Sales Service (Phase 3.3)
 *
 * Sales intelligence engine: next-best-action, funnel metrics,
 * conversion rates, follow-up suggestions, win/loss analysis.
 *
 * NO AI — all logic is deterministic Prisma aggregation + rule scoring.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { LeadsService } from '../leads/leads.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NextBestAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  targetEntityId: string;
  targetEntityType: 'lead' | 'deal' | 'customer';
}

export interface FunnelStage {
  stage: string;
  count: number;
  value: number;
  conversionRate: number;
}

export interface FunnelMetrics {
  tenantId: string;
  stages: FunnelStage[];
  totalLeads: number;
  totalDeals: number;
  totalWon: number;
  totalLost: number;
  overallConversionRate: number;
  avgDealValue: number;
  pipelineValue: number;
}

export interface WinLossEntry {
  dealId: string;
  title: string;
  value: number;
  status: 'WON' | 'LOST';
  stageId: string;
  closedAt: string | null;
  daysInPipeline: number | null;
  reason: string | null;
}

export interface WinLossAnalysis {
  totalWon: number;
  totalLost: number;
  winRate: number;
  totalWonValue: number;
  totalLostValue: number;
  avgWinValue: number;
  avgLossValue: number;
  avgDaysToClose: number | null;
  entries: WinLossEntry[];
}

export interface FollowUpSuggestion {
  leadId: string;
  leadName: string;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  reason: string;
  dueInDays: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly leadsService: LeadsService,
  ) {}

  // ── Next Best Action ──────────────────────────────────────────────

  /**
   * Recommend the single highest-value next action for a customer.
   * Rules (evaluated in priority order):
   *   1. Abandoned cart → send cart recovery email
   *   2. High-score unassigned lead → assign owner
   *   3. Open deal stale >14d → schedule follow-up
   *   4. No recent orders → re-engagement outreach
   *   5. Recent purchase → upsell related products
   */
  async getNextBestAction(customerId: string): Promise<NextBestAction | null> {
    // ── 1. Abandoned cart ────────────────────────────────────────────
    const abandonedCart = await this.prisma.cart.findFirst({
      where: { customerId, items: { some: {} } },
      include: { items: { include: { product: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    if (abandonedCart && abandonedCart.items.length > 0) {
      const cartAgeDays = Math.floor((Date.now() - abandonedCart.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (cartAgeDays <= 7) {
        return {
          action: 'Send cart recovery email',
          priority: 'high',
          reason: `Cart has ${abandonedCart.items.length} item(s) untouched for ${cartAgeDays} day(s).`,
          targetEntityId: customerId,
          targetEntityType: 'customer',
        };
      }
    }

    // ── 2. Check for open deals for this customer ───────────────────
    const openDeal = await this.prisma.deal.findFirst({
      where: { customerId, status: 'OPEN' },
      orderBy: { updatedAt: 'asc' },
    });

    if (openDeal) {
      const daysSinceUpdate = Math.floor((Date.now() - openDeal.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate >= 7) {
        return {
          action: 'Schedule follow-up call',
          priority: 'medium',
          reason: `Deal "${openDeal.title}" has been open for ${daysSinceUpdate} days without movement.`,
          targetEntityId: openDeal.id,
          targetEntityType: 'deal',
        };
      }
    }

    // ── 4. No recent orders → re-engagement ──────────────────────────
    const lastOrder = await this.prisma.order.findFirst({
      where: { customerId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastOrder) {
      const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { createdAt: true } });
      const daysSinceJoin = customer ? Math.floor((Date.now() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      if (daysSinceJoin > 30) {
        return {
          action: 'Send re-engagement campaign',
          priority: 'medium',
          reason: 'Customer has been registered for 30+ days without any order.',
          targetEntityId: customerId,
          targetEntityType: 'customer',
        };
      }
      return {
        action: 'Send welcome sequence',
        priority: 'high',
        reason: 'New customer with no orders yet.',
        targetEntityId: customerId,
        targetEntityType: 'customer',
      };
    }

    const daysSinceOrder = Math.floor((Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceOrder > 60) {
      return {
        action: 'Send re-engagement offer',
        priority: 'medium',
        reason: `Last order was ${daysSinceOrder} days ago.`,
        targetEntityId: customerId,
        targetEntityType: 'customer',
      };
    }

    // ── 5. Healthy — upsell ──────────────────────────────────────────
    return {
      action: 'Suggest complementary products',
      priority: 'low',
      reason: 'Customer is active and engaged. Explore upsell opportunities.',
      targetEntityId: customerId,
      targetEntityType: 'customer',
    };
  }

  // ── Sales Funnel ──────────────────────────────────────────────────

  /**
   * Full funnel metrics for a tenant.
   * Stages are derived from Lead statuses.
   */
  async getSalesFunnel(tenantId: string): Promise<FunnelMetrics> {
    const [leadStatusCounts, dealStatusCounts, openDealsAgg] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      this.prisma.deal.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
        _sum: { value: true },
      }),
      this.prisma.deal.aggregate({
        where: { tenantId, status: 'OPEN' },
        _sum: { value: true },
        _count: true,
      }),
    ]);

    const statusToCount = Object.fromEntries(leadStatusCounts.map((r) => [r.status, r._count.status]));
    const totalLeads = leadStatusCounts.reduce((sum, r) => sum + r._count.status, 0);

    const dealMap = Object.fromEntries(dealStatusCounts.map((r) => [r.status, { count: r._count.status, value: Number(r._sum.value || 0) }]));
    const totalDeals = dealStatusCounts.reduce((sum, r) => sum + r._count.status, 0);
    const totalWon = dealMap['WON']?.count ?? 0;
    const totalLost = dealMap['LOST']?.count ?? 0;
    const overallConversionRate = totalDeals > 0 ? Math.round((totalWon / totalDeals) * 100) : 0;
    const avgDealValue = totalDeals > 0 ? (dealMap['WON']?.value ?? 0) / totalWon : 0;

    // Build stage list from lead funnel stages
    const funnelStages: FunnelStage[] = [
      { stage: 'New Leads', count: statusToCount['NEW'] ?? 0, value: 0, conversionRate: 0 },
      { stage: 'Contacted', count: statusToCount['CONTACTED'] ?? 0, value: 0, conversionRate: 0 },
      { stage: 'Qualified', count: statusToCount['QUALIFIED'] ?? 0, value: 0, conversionRate: 0 },
      { stage: 'Proposals', count: statusToCount['PROPOSAL'] ?? 0, value: 0, conversionRate: 0 },
      { stage: 'Won Deals', count: totalWon, value: dealMap['WON']?.value ?? 0, conversionRate: overallConversionRate },
      { stage: 'Lost Deals', count: totalLost, value: dealMap['LOST']?.value ?? 0, conversionRate: 0 },
    ];

    // Calculate per-stage conversion rate
    let cumulative = 0;
    for (const stage of funnelStages) {
      cumulative += stage.count;
      if (funnelStages[0] && stage !== funnelStages[0] && totalLeads > 0) {
        stage.conversionRate = Math.round((cumulative / totalLeads) * 100);
      }
    }

    const pipelineValue = Number(openDealsAgg._sum.value ?? 0);

    this.eventBus.emit('sales.funnel.viewed', { tenantId });
    return {
      tenantId,
      stages: funnelStages,
      totalLeads,
      totalDeals,
      totalWon,
      totalLost,
      overallConversionRate,
      avgDealValue: Math.round(avgDealValue * 100) / 100,
      pipelineValue: Math.round(pipelineValue * 100) / 100,
    };
  }

  // ── Conversion Rate ───────────────────────────────────────────────

  /**
   * Period-based conversion rate for a tenant.
   * Period: '7d' | '30d' | '90d' | '1y'
   */
  async getConversionRate(tenantId: string, period = '30d'): Promise<{ period: string; rate: number; totalOrders: number; completedOrders: number; totalRevenue: number }> {
    const days = this._parsePeriod(period);
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);

    const [totalOrders, completedOrders, revenue] = await Promise.all([
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.order.count({ where: { tenantId, status: 'COMPLETED', createdAt: { gte: since } } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: since } },
        _sum: { total: true },
      }),
    ]);

    const rate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    this.eventBus.emit('sales.conversion.viewed', { tenantId, period, rate });
    return {
      period,
      rate,
      totalOrders,
      completedOrders,
      totalRevenue: Number(revenue._sum.total ?? 0),
    };
  }

  // ── Follow-up Suggestions ─────────────────────────────────────────

  /**
   * Recommend next action for a specific lead.
   */
  async suggestFollowUp(leadId: string): Promise<FollowUpSuggestion | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        assignedUser: { select: { firstName: true, lastName: true } },
        Deal: { where: { status: 'OPEN' }, take: 1 },
        Activity: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!lead) return null;

    const leadName = (`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.email) ?? 'Unknown Lead';
    const lastActivity = lead.Activity[0];
    const daysSinceActivity = lastActivity
      ? Math.floor((Date.now() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // ── High-value open deal → escalate ──────────────────────────────
    const openDeal = lead.Deal[0];
    if (openDeal && openDeal.value && Number(openDeal.value) > 10000) {
      return {
        leadId: lead.id,
        leadName,
        priority: 'high',
        suggestion: 'Escalate to senior sales rep — high-value deal',
        reason: `Deal worth ${openDeal.value} is open.`,
        dueInDays: 1,
      };
    }

    // ── No owner ─────────────────────────────────────────────────────
    if (!lead.assignedTo) {
      return {
        leadId: lead.id,
        leadName,
        priority: 'high',
        suggestion: 'Assign a sales rep',
        reason: 'Lead has no owner and may go cold.',
        dueInDays: 1,
      };
    }

    // ── Stale ────────────────────────────────────────────────────────
    if (daysSinceActivity >= 14) {
      return {
        leadId: lead.id,
        leadName,
        priority: 'medium',
        suggestion: 'Send follow-up email or call',
        reason: `No activity in ${daysSinceActivity} days.`,
        dueInDays: 2,
      };
    }

    // ── Recent but no deal ───────────────────────────────────────────
    if (!lead.Deal.length && lead.status !== 'WON' && lead.status !== 'LOST') {
      return {
        leadId: lead.id,
        leadName,
        priority: 'medium',
        suggestion: 'Qualify lead and create a deal',
        reason: `Lead is "${lead.status}" with no deal yet.`,
        dueInDays: 3,
      };
    }

    // ── Healthy ──────────────────────────────────────────────────────
    return {
      leadId: lead.id,
      leadName,
      priority: 'low',
      suggestion: 'Continue nurturing',
      reason: 'Recent activity — maintain cadence.',
      dueInDays: 7,
    };
  }

  // ── Win / Loss Analysis ───────────────────────────────────────────

  /**
   * Aggregate win/loss breakdown for the tenant.
   */
  async getWinLossAnalysis(tenantId: string): Promise<WinLossAnalysis> {
    const closedDeals = await this.prisma.deal.findMany({
      where: { tenantId, status: { in: ['WON', 'LOST'] } },
      include: { pipeline: { select: { name: true } } },
      orderBy: { closedAt: 'desc' },
    });

    const wonDeals = closedDeals.filter((d) => d.status === 'WON');
    const lostDeals = closedDeals.filter((d) => d.status === 'LOST');

    const totalWonValue = wonDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
    const totalLostValue = lostDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);

    const totalClosed = closedDeals.length;
    const winRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

    const avgDaysToClose = wonDeals.length > 0
      ? Math.round(
          wonDeals.reduce((sum, d) => {
            if (!d.createdAt || !d.closedAt) return sum;
            return sum + (d.closedAt.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          }, 0) / wonDeals.length,
        )
      : null;

    const entries: WinLossEntry[] = closedDeals.map((d) => ({
      dealId: d.id,
      title: d.title,
      value: Number(d.value ?? 0),
      status: d.status as 'WON' | 'LOST',
      stageId: d.stageId,
      closedAt: d.closedAt?.toISOString() ?? null,
      daysInPipeline: d.createdAt && d.closedAt
        ? Math.round((d.closedAt.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      reason: (d.metadata as Record<string, unknown> | null)?.reason as string | null ?? null,
    }));

    this.eventBus.emit('sales.winLoss.viewed', { tenantId, winRate });
    return {
      totalWon: wonDeals.length,
      totalLost: lostDeals.length,
      winRate,
      totalWonValue: Math.round(totalWonValue * 100) / 100,
      totalLostValue: Math.round(totalLostValue * 100) / 100,
      avgWinValue: wonDeals.length ? Math.round((totalWonValue / wonDeals.length) * 100) / 100 : 0,
      avgLossValue: lostDeals.length ? Math.round((totalLostValue / lostDeals.length) * 100) / 100 : 0,
      avgDaysToClose: avgDaysToClose,
      entries,
    };
  }

  // ── Private: Helpers ──────────────────────────────────────────────

  private _parsePeriod(period: string): number {
    const map: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    return map[period] ?? 30;
  }
}
