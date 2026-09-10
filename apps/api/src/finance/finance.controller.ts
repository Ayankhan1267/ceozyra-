/**
 * ZYRA — Finance Controller
 * Routes: GET/POST/PATCH/DELETE under /finance
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FinanceService, ExpenseCategory } from './finance.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface CreateExpenseBody {
  amount: number;
  category: ExpenseCategory;
  description?: string;
  vendor?: string;
  date?: string;
  receiptUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateExpenseBody {
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
  vendor?: string;
  date?: string;
  receiptUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface FinanceQuery {
  tenantId: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: string;
  limit?: string;
  period?: 'day' | 'week' | 'month' | 'year' | 'quarter';
  status?: string;
  customerId?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ── Revenue ────────────────────────────────────────────────────────────

  @Get('revenue')
  @UseGuards(AuthGuard, RolesGuard)
  async getRevenue(@Query() query: FinanceQuery) {
    if (!query.tenantId) throw new BadRequestException('tenantId is required');

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.financeService.getRevenue(query.tenantId, {
      startDate,
      endDate,
      category: query.category,
    });
  }

  @Get('revenue/period')
  @UseGuards(AuthGuard, RolesGuard)
  async getRevenueByPeriod(
    @Query('tenantId') tenantId: string,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.getRevenueByPeriod(tenantId, period);
  }

  @Get('revenue/breakdown')
  @UseGuards(AuthGuard, RolesGuard)
  async getRevenueBreakdown(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.getRevenueBreakdown(
      tenantId,
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date(),
    );
  }

  @Get('mrr')
  @UseGuards(AuthGuard, RolesGuard)
  async getMRR(@Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.getMRR(tenantId);
  }

  // ── Expenses ───────────────────────────────────────────────────────────

  @Post('expenses')
  @UseGuards(AuthGuard, RolesGuard)
  async createExpense(@Query('tenantId') tenantId: string, @Body() body: CreateExpenseBody) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.createExpense(tenantId, body);
  }

  @Get('expenses')
  @UseGuards(AuthGuard, RolesGuard)
  async listExpenses(@Query() query: FinanceQuery) {
    if (!query.tenantId) throw new BadRequestException('tenantId is required');

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.financeService.listExpenses(query.tenantId, {
      category: query.category as ExpenseCategory | undefined,
      startDate,
      endDate,
    });
  }

  @Patch('expenses/:id')
  @UseGuards(AuthGuard, RolesGuard)
  async updateExpense(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateExpenseBody,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.updateExpense(tenantId, id, body);
  }

  @Delete('expenses/:id')
  @UseGuards(AuthGuard, RolesGuard)
  async deleteExpense(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.deleteExpense(tenantId, id);
  }

  @Get('expenses/breakdown')
  @UseGuards(AuthGuard, RolesGuard)
  async getExpenseBreakdown(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.getExpenseBreakdown(
      tenantId,
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date(),
    );
  }

  // ── P&L ────────────────────────────────────────────────────────────────

  @Get('pl')
  @UseGuards(AuthGuard, RolesGuard)
  async getProfitAndLoss(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const fromDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = endDate ? new Date(endDate) : new Date();

    return this.financeService.getProfitAndLoss(tenantId, fromDate, toDate);
  }

  @Get('cogs')
  @UseGuards(AuthGuard, RolesGuard)
  async getCOGS(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const fromDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = endDate ? new Date(endDate) : new Date();

    const cogs = await this.financeService.calculateCOGS(tenantId, fromDate, toDate);
    return { cogs, fromDate, toDate };
  }

  @Get('gross-margin')
  @UseGuards(AuthGuard, RolesGuard)
  async getGrossMargin(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const fromDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = endDate ? new Date(endDate) : new Date();

    return this.financeService.getGrossMargin(tenantId, fromDate, toDate);
  }

  // ── Cash Flow ──────────────────────────────────────────────────────────

  @Get('cash-flow')
  @UseGuards(AuthGuard, RolesGuard)
  async getCashFlow(
    @Query('tenantId') tenantId: string,
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.getCashFlow(tenantId, period);
  }

  // ── Key Metrics ────────────────────────────────────────────────────────

  @Get('metrics')
  @UseGuards(AuthGuard, RolesGuard)
  async getKeyMetrics(@Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.getKeyMetrics(tenantId);
  }

  // ── Invoices ───────────────────────────────────────────────────────────

  @Post('invoices')
  @UseGuards(AuthGuard, RolesGuard)
  async createInvoice(@Query('tenantId') tenantId: string, @Body('orderId') orderId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    if (!orderId) throw new BadRequestException('orderId is required');
    return this.financeService.createInvoice(tenantId, orderId);
  }

  @Get('invoices')
  @UseGuards(AuthGuard, RolesGuard)
  async listInvoices(@Query() query: FinanceQuery) {
    if (!query.tenantId) throw new BadRequestException('tenantId is required');

    return this.financeService.listInvoices(query.tenantId, {
      status: query.status,
      customerId: query.customerId,
    });
  }

  @Get('invoices/:id')
  @UseGuards(AuthGuard, RolesGuard)
  async getInvoice(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.financeService.getInvoice(tenantId, id);
  }
}
