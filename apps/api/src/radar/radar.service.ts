/**
 * ZYRA — Business Radar Service (Phase 7.1)
 * Composite health scoring, anomaly detection, opportunity identification, and alerting.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface HealthScores {
  revenue: number;
  customer: number;
  inventory: number;
  marketing: number;
  ops: number;
  overall: number;
  breakdown: {
    revenue: { score: number; label: string };
    customer: { score: number; label: string };
    inventory: { score: number; label: string };
    marketing: { score: number; label: string };
    ops: { score: number; label: string };
  };
}

export interface Anomaly {
  id: string;
  severity: 'CRITICAL' | 'WARNING';
  type: 'order_drop' | 'revenue_drop' | 'refund_spike' | 'low_stock' | 'cart_abandonment' | 'churn';
  title: string;
  description: string;
  value: number;
  threshold: number;
  detectedAt: string;
}

export interface Opportunity {
  id: string;
  type: 'top_seller' | 'high_traffic_low_conversion' | 'underperforming_channel' | 'upsell_opportunity';
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedValue?: number;
  productName?: string;
  productId?: string;
  channelName?: string;
}

export interface Alert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string;
  title: string;
  message: string;
  detectedAt: string;
  actionable: boolean;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RadarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── Health Check ─────────────────────────────────────────────────────────────

  async runHealthCheck(tenantId: string): Promise<HealthScores> {
    const [
      revenueScore,
      customerScore,
      inventoryScore,
      marketingScore,
      opsScore,
    ] = await Promise.all([
      this._scoreRevenue(tenantId),
      this._scoreCustomer(tenantId),
      this._scoreInventory(tenantId),
      this._scoreMarketing(tenantId),
      this._scoreOps(tenantId),
    ]);

    const overall = Math.round(
      revenueScore * 0.30 +
        customerScore * 0.25 +
        inventoryScore * 0.20 +
        marketingScore * 0.15 +
        opsScore * 0.10,
    );

    const breakdown = {
      revenue: { score: revenueScore, label: this._healthLabel(revenueScore) },
      customer: { score: customerScore, label: this._healthLabel(customerScore) },
      inventory: { score: inventoryScore, label: this._healthLabel(inventoryScore) },
      marketing: { score: marketingScore, label: this._healthLabel(marketingScore) },
      ops: { score: opsScore, label: this._healthLabel(opsScore) },
    };

    return { revenue: revenueScore, customer: customerScore, inventory: inventoryScore, marketing: marketingScore, ops: opsScore, overall, breakdown };
  }

  private async _scoreRevenue(tenantId: string): Promise<number> {
    const now = new Date();
    const currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentRevenue, previousRevenue, recentOrders] = await Promise.all([
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: currentPeriodStart } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: previousPeriodStart, lt: currentPeriodStart } },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { tenantId, createdAt: { gte: currentPeriodStart } },
      }),
    ]);

    const current = currentRevenue._sum.total || 0;
    const previous = previousRevenue._sum.total || 0;
    const growth = previous > 0 ? (current - previous) / previous : 1;
    const orderVolume = recentOrders;

    let score = 50;
    if (growth > 0.2) score += 30;
    else if (growth > 0) score += 15;
    else if (growth > -0.2) score -= 10;
    else score -= 30;

    if (orderVolume > 50) score += 10;
    else if (orderVolume > 10) score += 5;
    else if (orderVolume === 0) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  private async _scoreCustomer(tenantId: string): Promise<number> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [totalCustomers, newCustomers, repeatCustomers] = await Promise.all([
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.customer.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.order.findMany({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo, lte: now } },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
    ]);

    const repeatRate = repeatCustomers.length > 0 && newCustomers > 0 ? Math.min(repeatCustomers.length / (repeatCustomers.length + newCustomers), 1) : 0;

    let score = 50;
    if (totalCustomers > 100) score += 20;
    else if (totalCustomers > 20) score += 10;
    else if (totalCustomers === 0) score -= 20;

    if (repeatRate > 0.3) score += 20;
    else if (repeatRate > 0.1) score += 10;
    else if (repeatRate === 0 && totalCustomers > 10) score -= 10;

    if (newCustomers > 20) score += 10;
    else if (newCustomers === 0 && totalCustomers > 0) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private async _scoreInventory(tenantId: string): Promise<number> {
    const [totalItems, lowStockCount, outOfStockCount] = await Promise.all([
      this.prisma.inventoryItem.count({ where: { tenantId } }),
      this.prisma.lowStockAlert.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.inventoryItem.count({ where: { tenantId, quantity: 0 } }),
    ]);

    if (totalItems === 0) return 50;

    let score = 100;
    const problemRatio = (lowStockCount + outOfStockCount * 2) / totalItems;
    score -= problemRatio * 100;

    if (outOfStockCount > 0) score -= 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private async _scoreMarketing(tenantId: string): Promise<number> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [campaignCount, activeCampaigns, completedOrders] = await Promise.all([
      this.prisma.campaign.count({ where: { tenantId } }),
      this.prisma.campaign.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    let score = 50;
    if (activeCampaigns > 0) score += 20;
    if (campaignCount > 3) score += 15;
    else if (campaignCount > 0) score += 10;
    else score -= 10;

    if (completedOrders > 20) score += 15;
    else if (completedOrders > 5) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private async _scoreOps(tenantId: string): Promise<number> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      pendingOrders,
      recentRefunds,
      totalOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.refund.count({ where: { tenantId, createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: sevenDaysAgo } } }),
    ]);

    let score = 100;
    if (totalOrders > 0) {
      score -= (pendingOrders / totalOrders) * 40;
      score -= (recentRefunds / totalOrders) * 50;
    }

    if (pendingOrders > 20) score -= 20;
    if (recentRefunds > 10) score -= 20;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private _healthLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Critical';
  }

  // ── Anomalies ────────────────────────────────────────────────────────────────

  async detectAnomalies(tenantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const now = new Date();

    // 1. Order drop — compare last 7 days vs previous 7 days
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prev7 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const [currentOrders, previousOrders] = await Promise.all([
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: last7 } } }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: prev7, lt: last7 } } }),
    ]);
    if (previousOrders > 0 && currentOrders < previousOrders * 0.5) {
      anomalies.push({
        id: `anom-orders-${Date.now()}`,
        severity: 'CRITICAL',
        type: 'order_drop',
        title: 'Order Volume Drop',
        description: `Orders dropped ${Math.round((1 - currentOrders / previousOrders) * 100)}% compared to last week`,
        value: currentOrders,
        threshold: previousOrders * 0.5,
        detectedAt: now.toISOString(),
      });
    }

    // 2. Revenue drop
    const [currentRevenue, previousRevenue] = await Promise.all([
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: last7 } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: prev7, lt: last7 } },
        _sum: { total: true },
      }),
    ]);
    const currentRev = currentRevenue._sum.total || 0;
    const prevRev = previousRevenue._sum.total || 0;
    if (prevRev > 0 && currentRev < prevRev * 0.5) {
      anomalies.push({
        id: `anom-revenue-${Date.now()}`,
        severity: 'CRITICAL',
        type: 'revenue_drop',
        title: 'Revenue Drop',
        description: `Revenue dropped ${Math.round((1 - currentRev / prevRev) * 100)}% compared to last week`,
        value: Number(currentRev),
        threshold: Number(prevRev * 0.5),
        detectedAt: now.toISOString(),
      });
    }

    // 3. Refund spike
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const refundCount = await this.prisma.refund.count({
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
    });
    if (refundCount > 10) {
      anomalies.push({
        id: `anom-refund-${Date.now()}`,
        severity: 'WARNING',
        type: 'refund_spike',
        title: 'Refund Spike',
        description: `${refundCount} refunds in the last 7 days — investigate product or fulfillment issues`,
        value: refundCount,
        threshold: 10,
        detectedAt: now.toISOString(),
      });
    }

    // 4. Low stock
    const lowStockCount = await this.prisma.lowStockAlert.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (lowStockCount > 5) {
      anomalies.push({
        id: `anom-stock-${Date.now()}`,
        severity: 'WARNING',
        type: 'low_stock',
        title: 'Multiple Low Stock Alerts',
        description: `${lowStockCount} products are currently out of stock or below threshold`,
        value: lowStockCount,
        threshold: 5,
        detectedAt: now.toISOString(),
      });
    }

    // 5. Cart abandonment — carts older than 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const abandonedCarts = await this.prisma.cart.count({
      where: {
        tenantId,
        updatedAt: { lt: twoHoursAgo },
        items: { some: {} },
      },
    });
    if (abandonedCarts > 10) {
      anomalies.push({
        id: `anom-cart-${Date.now()}`,
        severity: 'WARNING',
        type: 'cart_abandonment',
        title: 'Cart Abandonment Rate High',
        description: `${abandonedCarts} carts have been abandoned (no activity for 2+ hours)`,
        value: abandonedCarts,
        threshold: 10,
        detectedAt: now.toISOString(),
      });
    }

    return anomalies;
  }

  // ── Opportunities ────────────────────────────────────────────────────────────

  async identifyOpportunities(tenantId: string): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Top sellers
    const topProducts = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { tenantId, status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } } },
      _sum: { quantity: true, revenue: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 3,
    });

    for (const tp of topProducts) {
      const product = await this.prisma.product.findUnique({
        where: { id: tp.productId },
        select: { name: true },
      });
      opportunities.push({
        id: `opp-top-${tp.productId}`,
        type: 'top_seller',
        title: `${product?.name || 'Product'} is a top seller`,
        description: `Sold ${tp._sum.quantity} units in the last 30 days — consider increasing stock and promoting`,
        impact: 'HIGH',
        estimatedValue: Number(tp._sum.revenue || 0),
        productName: product?.name,
        productId: tp.productId,
      });
    }

    // 2. High traffic low conversion — find products with views but low orders
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      take: 20,
    });

    for (const product of products) {
      const orderCount = await this.prisma.orderItem.count({
        where: { productId: product.id, order: { tenantId, status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } } },
      });
      // Use review count as a proxy for traffic/engagement
      const reviewCount = await this.prisma.review.count({
        where: { tenantId, productId: product.id, createdAt: { gte: thirtyDaysAgo } },
      });
      if (reviewCount > 5 && orderCount === 0) {
        opportunities.push({
          id: `opp-conversion-${product.id}`,
          type: 'high_traffic_low_conversion',
          title: `${product.name} has engagement but no sales`,
          description: `${reviewCount} reviews but 0 orders — review pricing, images, and description`,
          impact: 'MEDIUM',
          productName: product.name,
          productId: product.id,
        });
      }
    }

    // 3. Underperforming channels — no active campaigns
    const activeCampaigns = await this.prisma.campaign.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    const totalCampaigns = await this.prisma.campaign.count({ where: { tenantId } });
    if (totalCampaigns > 0 && activeCampaigns === 0) {
      opportunities.push({
        id: 'opp-channel-1',
        type: 'underperforming_channel',
        title: 'No active marketing campaigns',
        description: 'All campaigns are inactive — re-engage customers with a new campaign',
        impact: 'HIGH',
        channelName: 'All channels',
      });
    }

    // 4. Upsell opportunities — customers with single-item orders
    const singleItemCustomers = await this.prisma.order.findMany({
      where: { tenantId, status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
      include: { items: true },
    });

    const singleItemOrders = singleItemCustomers.filter((o) => o.items.length === 1);
    if (singleItemOrders.length > 5) {
      opportunities.push({
        id: 'opp-upsell-1',
        type: 'upsell_opportunity',
        title: 'Upsell opportunity identified',
        description: `${singleItemOrders.length} customers bought only 1 item — bundle or cross-sell recommendations could increase AOV`,
        impact: 'MEDIUM',
        estimatedValue: singleItemOrders.length * 15,
      });
    }

    return opportunities.slice(0, 10);
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────

  async generateAlerts(tenantId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const now = new Date();

    // Run health check for critical ops score
    const health = await this.runHealthCheck(tenantId);
    if (health.ops < 30) {
      alerts.push({
        id: `alert-ops-${Date.now()}`,
        severity: 'CRITICAL',
        category: 'Operations',
        title: 'Operations Health Critical',
        message: `Operations score is ${health.ops}/100 — review pending orders, refunds, and fulfillment`,
        detectedAt: now.toISOString(),
        actionable: true,
      });
    }
    if (health.revenue < 30) {
      alerts.push({
        id: `alert-rev-${Date.now()}`,
        severity: 'CRITICAL',
        category: 'Revenue',
        title: 'Revenue Health Critical',
        message: `Revenue score is ${health.revenue}/100 — investigate order volume and conversion`,
        detectedAt: now.toISOString(),
        actionable: true,
      });
    }

    // Low stock alerts from inventory
    const lowStockAlerts = await this.prisma.lowStockAlert.findMany({
      where: { tenantId, status: 'ACTIVE' },
      take: 5,
      include: {
        product: { select: { name: true } },
      },
    });
    for (const alert of lowStockAlerts) {
      alerts.push({
        id: `alert-stock-${alert.id}`,
        severity: 'WARNING',
        category: 'Inventory',
        title: `Low stock: ${alert.product?.name || 'Unknown product'}`,
        message: `Current qty: ${alert.currentQuantity}, threshold: ${alert.threshold} — reorder recommended`,
        detectedAt: alert.createdAt.toISOString(),
        actionable: true,
      });
    }

    // Pending orders aging
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const staleOrders = await this.prisma.order.count({
      where: { tenantId, status: 'PENDING', createdAt: { lt: threeDaysAgo } },
    });
    if (staleOrders > 5) {
      alerts.push({
        id: `alert-pending-${Date.now()}`,
        severity: 'WARNING',
        category: 'Orders',
        title: 'Stale Pending Orders',
        message: `${staleOrders} orders have been pending for 3+ days — review and process`,
        detectedAt: now.toISOString(),
        actionable: true,
      });
    }

    // Positive: healthy overall
    if (alerts.length === 0 && health.overall >= 70) {
      alerts.push({
        id: `alert-healthy-${Date.now()}`,
        severity: 'INFO',
        category: 'Health',
        title: 'Business Health is Good',
        message: `Overall health score: ${health.overall}/100 — all systems running smoothly`,
        detectedAt: now.toISOString(),
        actionable: false,
      });
    }

    // Sort: CRITICAL first, then WARNING, then INFO
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return alerts;
  }
}
