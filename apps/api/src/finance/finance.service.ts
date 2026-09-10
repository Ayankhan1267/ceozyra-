/**
 * ZYRA — Finance Service
 * Full finance module: revenue, expenses, invoices, P&L, cash flow, key metrics
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { Prisma } from '@prisma/client';

// ─── Enums & Types ────────────────────────────────────────────────────────────

export type ExpenseCategory = 'SALARY' | 'RENT' | 'MARKETING' | 'SOFTWARE' | 'SUPPLIES' | 'SHIPPING' | 'OTHER';

export interface RevenueDto {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  source?: string;
  category?: string;
  orderId?: string;
  description?: string;
  recordedAt: Date;
  createdAt: Date;
}

export interface ExpenseDto {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description?: string;
  vendor?: string;
  date: Date;
  receiptUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseDto {
  amount: number;
  category: ExpenseCategory;
  description?: string;
  vendor?: string;
  date?: string;
  receiptUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceDto {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  type: string;
  customerId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: Date;
  issuedAt?: Date;
  paidAt?: Date;
  lineItems?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PnLResult {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  margin: number;
  period: { start: Date; end: Date };
}

export interface KeyMetrics {
  cac: number;
  ltv: number;
  aov: number;
  grossMargin: number;
  netProfit: number;
  burnRate: number;
  mrr: number;
  totalRevenue: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {
    // Auto-record revenue when an order is completed
    this.eventService.on('order.completed', async (payload: Record<string, unknown>) => {
      const { orderId, tenantId, total } = payload as {
        orderId: string;
        tenantId: string;
        total: number;
      };

      const existing = await this.prisma.revenue.findFirst({
        where: { tenantId, orderId },
      });

      if (!existing) {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { orderNumber: true },
        });

        await this.prisma.revenue.create({
          data: {
            tenantId,
            orderId,
            amount: total,
            currency: 'USD',
            source: 'order',
            category: 'Sales',
            description: `Order ${order?.orderNumber ?? orderId}`,
            recordedAt: new Date(),
          },
        });
      }
    });
  }

  // ── Revenue ─────────────────────────────────────────────────────────────

  async recordRevenue(tenantId: string, orderId: string, amount: number, description?: string) {
    const existing = await this.prisma.revenue.findFirst({
      where: { tenantId, orderId },
    });

    if (existing) {
      return existing;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });

    return this.prisma.revenue.create({
      data: {
        tenantId,
        orderId,
        amount,
        currency: 'USD',
        source: 'order',
        category: 'Sales',
        description: description ?? `Order ${order?.orderNumber ?? orderId}`,
        recordedAt: new Date(),
      },
    });
  }

  async getRevenue(tenantId: string, filters?: { startDate?: Date; endDate?: Date; category?: string }) {
    const where: Prisma.RevenueWhereInput = { tenantId };

    if (filters?.startDate || filters?.endDate) {
      (where.recordedAt as Prisma.DateTimeFilter) = {};
      if (filters.startDate) (where.recordedAt as Prisma.DateTimeFilter).gte = filters.startDate;
      if (filters.endDate) (where.recordedAt as Prisma.DateTimeFilter).lte = filters.endDate;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    const [revenues, totalAgg] = await Promise.all([
      this.prisma.revenue.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.revenue.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      revenues: revenues.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        currency: r.currency,
        source: r.source,
        category: r.category,
        orderId: r.orderId,
        description: r.description,
        recordedAt: r.recordedAt,
        createdAt: r.createdAt,
      })),
      total: Number(totalAgg._sum.amount) || 0,
    };
  }

  async getRevenueByPeriod(tenantId: string, period: 'day' | 'week' | 'month' | 'year') {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const total = await this.prisma.revenue.aggregate({
      where: {
        tenantId,
        recordedAt: { gte: start },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    // Daily breakdown for chart
    const days: { date: string; amount: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= now) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTotal = await this.prisma.revenue.aggregate({
        where: {
          tenantId,
          recordedAt: { gte: cursor, lte: dayEnd },
        },
        _sum: { amount: true },
      });

      days.push({
        date: cursor.toISOString().slice(0, 10),
        amount: Number(dayTotal._sum.amount) || 0,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      period,
      start,
      end: now,
      total: Number(total._sum.amount) || 0,
      count: total._count._all,
      breakdown: days,
    };
  }

  async getMRR(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [current, previous] = await Promise.all([
      this.prisma.revenue.aggregate({
        where: { tenantId, recordedAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.revenue.aggregate({
        where: { tenantId, recordedAt: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { amount: true },
      }),
    ]);

    const currentMRR = Number(current._sum.amount) || 0;
    const prevMRR = Number(previous._sum.amount) || 0;
    const change = prevMRR > 0 ? ((currentMRR - prevMRR) / prevMRR) * 100 : 0;

    return {
      mrr: currentMRR,
      previousMRR: prevMRR,
      changePercent: Math.round(change * 100) / 100,
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
    };
  }

  // ── Expenses ────────────────────────────────────────────────────────────

  async createExpense(tenantId: string, dto: CreateExpenseDto) {
    const date = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.expense.create({
      data: {
        tenantId,
        amount: dto.amount,
        currency: 'USD',
        category: dto.category,
        description: dto.description,
        vendor: dto.vendor,
        date,
        receiptUrl: dto.receiptUrl,
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async listExpenses(tenantId: string, filters?: { category?: ExpenseCategory; startDate?: Date; endDate?: Date }) {
    const where: Prisma.ExpenseWhereInput = { tenantId };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.startDate || filters?.endDate) {
      (where.date as Prisma.DateTimeFilter) = {};
      if (filters.startDate) (where.date as Prisma.DateTimeFilter).gte = filters.startDate;
      if (filters.endDate) (where.date as Prisma.DateTimeFilter).lte = filters.endDate;
    }

    const [expenses, totalAgg] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
      }),
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      expenses: expenses.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        currency: e.currency,
        category: e.category,
        description: e.description,
        vendor: e.vendor,
        date: e.date,
        receiptUrl: e.receiptUrl,
        metadata: e.metadata,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
      total: Number(totalAgg._sum.amount) || 0,
    };
  }

  async updateExpense(tenantId: string, expenseId: string, data: Partial<CreateExpenseDto>) {
    const existing = await this.prisma.expense.findFirst({
      where: { id: expenseId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    const updateData: Prisma.ExpenseUpdateInput = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.category) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.vendor !== undefined) updateData.vendor = data.vendor;
    if (data.date) updateData.date = new Date(data.date);
    if (data.receiptUrl !== undefined) updateData.receiptUrl = data.receiptUrl;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Prisma.InputJsonValue;

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
    });
  }

  async deleteExpense(tenantId: string, expenseId: string) {
    const existing = await this.prisma.expense.findFirst({
      where: { id: expenseId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    await this.prisma.expense.delete({ where: { id: expenseId } });
    return { success: true };
  }

  // ── Cost of Goods Sold (COGS) ───────────────────────────────────────────

  async calculateCOGS(tenantId: string, fromDate: Date, toDate: Date): Promise<number> {
    const completedOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: { gte: fromDate, lte: toDate },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    let totalCOGS = 0;

    for (const order of completedOrders) {
      for (const item of order.items) {
        // Use product cost if available; otherwise fallback to 60% of unitPrice
        const productCost = item.product?.cost != null ? Number(item.product.cost) : Number(item.unitPrice) * 0.6;
        totalCOGS += item.quantity * productCost;
      }
    }

    return Math.round(totalCOGS * 100) / 100;
  }

  async getGrossMargin(tenantId: string, fromDate: Date, toDate: Date): Promise<{ revenue: number; cogs: number; grossProfit: number; margin: number }> {
    const revenueAgg = await this.prisma.revenue.aggregate({
      where: {
        tenantId,
        recordedAt: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
    });

    const revenue = Number(revenueAgg._sum.amount) || 0;
    const cogs = await this.calculateCOGS(tenantId, fromDate, toDate);
    const grossProfit = revenue - cogs;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      revenue,
      cogs,
      grossProfit: Math.round(grossProfit * 100) / 100,
      margin: Math.round(margin * 100) / 100,
    };
  }

  // ── Profit & Loss ──────────────────────────────────────────────────────

  async getProfitAndLoss(tenantId: string, fromDate: Date, toDate: Date): Promise<PnLResult> {
    const [
      revenueAgg,
      cogs,
      expensesAgg,
    ] = await Promise.all([
      this.prisma.revenue.aggregate({
        where: { tenantId, recordedAt: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
      }),
      this.calculateCOGS(tenantId, fromDate, toDate),
      this.prisma.expense.aggregate({
        where: { tenantId, date: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
      }),
    ]);

    const revenue = Number(revenueAgg._sum.amount) || 0;
    const expenses = Number(expensesAgg._sum.amount) || 0;
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      period: { start: fromDate, end: toDate },
    };
  }

  // ── Cash Flow ──────────────────────────────────────────────────────────

  async getCashFlow(tenantId: string, period: 'week' | 'month' | 'quarter' | 'year') {
    const now = new Date();
    let fromDate: Date;

    switch (period) {
      case 'week':
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 7);
        break;
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        fromDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      case 'year':
        fromDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const toDate = now;

    const [revenueAgg, expensesAgg, invoicesAgg] = await Promise.all([
      this.prisma.revenue.aggregate({
        where: { tenantId, recordedAt: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { tenantId, date: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
      }),
    ]);

    const inflows = Number(revenueAgg._sum.amount) || 0;
    const outflows = Number(expensesAgg._sum.amount) || 0;
    const netCashFlow = inflows - outflows;
    const operatingCashFlow = inflows - outflows;
    const closingBalance = netCashFlow; // simplified — opening balance would come from prior period

    return {
      period,
      fromDate,
      toDate,
      inflows: Math.round(inflows * 100) / 100,
      outflows: Math.round(outflows * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      operatingCashFlow: Math.round(operatingCashFlow * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
    };
  }

  // ── Key Metrics ────────────────────────────────────────────────────────

  async getKeyMetrics(tenantId: string): Promise<KeyMetrics> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalRevenueResult,
      completedOrdersCount,
      avgOrderResult,
      customersCount,
      monthExpensesResult,
      monthRevenueResult,
      totalCommissions,
    ] = await Promise.all([
      this.prisma.revenue.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      }),
      this.prisma.order.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _avg: { total: true },
      }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.expense.aggregate({
        where: { tenantId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.revenue.aggregate({
        where: { tenantId, recordedAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.commission.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { partnerShare: true, headShare: true },
      }),
    ]);

    const totalRevenue = Number(totalRevenueResult._sum.amount) || 0;
    const avgOrder = Number(avgOrderResult._avg.total) || 0;
    const cogs = await this.calculateCOGS(tenantId, new Date(0), now);
    const grossProfit = totalRevenue - cogs;
    const totalExpensesAllTime = await this.getTotalExpenses(tenantId);
    const netProfit = grossProfit - totalExpensesAllTime;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // CAC = total commissions (sales cost) / customers acquired (use total customers)
    const totalCommissionPaid = Number(totalCommissions._sum.partnerShare) + Number(totalCommissions._sum.headShare);
    const cac = customersCount > 0 ? totalCommissionPaid / customersCount : 0;

    // LTV = total revenue / customers
    const ltv = customersCount > 0 ? totalRevenue / customersCount : 0;

    // AOV = average order value
    const aov = completedOrdersCount > 0 ? avgOrder : 0;

    // Burn rate = monthly expenses
    const burnRate = Number(monthExpensesResult._sum.amount) || 0;

    // MRR
    const monthRevenue = Number(monthRevenueResult._sum.amount) || 0;

    return {
      cac: Math.round(cac * 100) / 100,
      ltv: Math.round(ltv * 100) / 100,
      aov: Math.round(aov * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      burnRate: Math.round(burnRate * 100) / 100,
      mrr: Math.round(monthRevenue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    };
  }

  private async getTotalExpenses(tenantId: string): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      where: { tenantId },
      _sum: { amount: true },
    });
    return Number(result._sum.amount) || 0;
  }

  // ── Invoices ───────────────────────────────────────────────────────────

  async createInvoice(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const count = await this.prisma.invoice.count({
      where: { tenantId },
    });

    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

    const lineItems = order.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    }));

    return this.prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        type: 'INVOICE',
        customerId: order.customerId,
        orderId: order.id,
        amount: Number(order.total),
        currency: order.currency,
        status: 'DRAFT',
        lineItems,
        issuedAt: new Date(),
      },
    });
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        order: {
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async listInvoices(tenantId: string, filters?: { status?: string; customerId?: string }) {
    const where: Prisma.InvoiceWhereInput = { tenantId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    const [invoices, totalAgg] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              customer: true,
            },
          },
        },
      }),
      this.prisma.invoice.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        customerId: inv.customerId,
        orderId: inv.orderId,
        amount: Number(inv.amount),
        currency: inv.currency,
        status: inv.status,
        dueDate: inv.dueDate,
        issuedAt: inv.issuedAt,
        paidAt: inv.paidAt,
        lineItems: inv.lineItems,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        order: inv.order
          ? {
              id: inv.order.id,
              orderNumber: inv.order.orderNumber,
              total: Number(inv.order.total),
              customer: inv.order.customer
                ? {
                    id: inv.order.customer.id,
                    email: inv.order.customer.email,
                    firstName: inv.order.customer.firstName,
                    lastName: inv.order.customer.lastName,
                  }
                : null,
            }
          : null,
      })),
      total: Number(totalAgg._sum.amount) || 0,
    };
  }

  // ── Expense Breakdown by Category ──────────────────────────────────────

  async getExpenseBreakdown(tenantId: string, fromDate: Date, toDate: Date) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId,
        date: { gte: fromDate, lte: toDate },
      },
    });

    const breakdown: Record<string, { category: string; total: number; count: number }> = {};
    let grandTotal = 0;

    for (const expense of expenses) {
      const cat = expense.category || 'OTHER';
      const amount = Number(expense.amount);
      if (!breakdown[cat]) {
        breakdown[cat] = { category: cat, total: 0, count: 0 };
      }
      breakdown[cat].total += amount;
      breakdown[cat].count += 1;
      grandTotal += amount;
    }

    return {
      categories: Object.values(breakdown).map((b) => ({
        ...b,
        total: Math.round(b.total * 100) / 100,
        percentage: grandTotal > 0 ? Math.round((b.total / grandTotal) * 10000) / 100 : 0,
      })),
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }

  // ── Revenue by Category ────────────────────────────────────────────────

  async getRevenueBreakdown(tenantId: string, fromDate: Date, toDate: Date) {
    const revenues = await this.prisma.revenue.findMany({
      where: {
        tenantId,
        recordedAt: { gte: fromDate, lte: toDate },
      },
    });

    const breakdown: Record<string, { category: string; total: number; count: number }> = {};
    let grandTotal = 0;

    for (const rev of revenues) {
      const cat = rev.category || 'Uncategorized';
      const amount = Number(rev.amount);
      if (!breakdown[cat]) {
        breakdown[cat] = { category: cat, total: 0, count: 0 };
      }
      breakdown[cat].total += amount;
      breakdown[cat].count += 1;
      grandTotal += amount;
    }

    return {
      categories: Object.values(breakdown).map((b) => ({
        ...b,
        total: Math.round(b.total * 100) / 100,
        percentage: grandTotal > 0 ? Math.round((b.total / grandTotal) * 10000) / 100 : 0,
      })),
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }
}
