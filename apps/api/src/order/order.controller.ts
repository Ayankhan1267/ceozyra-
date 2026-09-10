/**
 * ZYRA — Order Controller
 * Full order lifecycle: list, detail, status transitions, ship, deliver, cancel, invoice
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import {
  OrderService,
  type CreateOrderDto,
  type UpdateOrderStatusDto,
  type ShipOrderDto,
  type CancelOrderDto,
  type OrderFilterDto,
} from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ── List & Search ──────────────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'read')
  list(@Query() filter: OrderFilterDto) {
    const { status, customerId, startDate, endDate, page, limit } = filter;
    if (status || customerId || startDate || endDate) {
      return this.orderService.filter({
        status: status as any,
        customerId,
        startDate,
        endDate,
        page: page ? +page : 1,
        limit: limit ? +limit : 20,
      });
    }
    return this.orderService.findByTenant(filter.tenantId ?? '', +(filter.page ?? 1), +(filter.limit ?? 20));
  }

  @Get('tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'read')
  findByTenant(
    @Param('tenantId') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.orderService.findByTenant(tenantId, +page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  @Get('number/:orderNumber')
  findByNumber(@Param('orderNumber') orderNumber: string) {
    return this.orderService.findByOrderNumber(orderNumber);
  }

  @Get('customer/:customerId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'read')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.orderService.findByCustomer(customerId);
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  @Get('tenant/:tenantId/stats')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'read')
  getStats(@Param('tenantId') tenantId: string) {
    return this.orderService.getStats(tenantId);
  }

  // ── Create ─────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'create')
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  // ── Status Updates ─────────────────────────────────────────────────────

  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateStatus(id, dto);
  }

  @Post(':id/ship')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'update')
  ship(@Param('id') id: string, @Body() dto: ShipOrderDto) {
    return this.orderService.ship(id, dto);
  }

  @Post(':id/deliver')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'update')
  deliver(@Param('id') id: string) {
    return this.orderService.deliver(id);
  }

  @Post(':id/complete')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'update')
  complete(@Param('id') id: string) {
    return this.orderService.complete(id);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'update')
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orderService.cancel(id, dto);
  }

  // ── Invoice ────────────────────────────────────────────────────────────

  @Get(':id/invoice')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('orders', 'read')
  invoice(@Param('id') id: string) {
    return this.orderService.getInvoiceData(id);
  }
}
