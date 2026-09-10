/**
 * ZYRA — Purchase Orders Controller
 * REST endpoints for purchase order management.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  list(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.poService.list(tenantId, {
      status,
      supplierId,
      dateFrom,
      dateTo,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.poService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'create')
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.poService.create({ ...dto, tenantId } as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.poService.update(id, dto);
  }

  @Post(':id/receive')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  receive(@Param('id') id: string) {
    return this.poService.receive(id);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  cancel(@Param('id') id: string) {
    return this.poService.cancel(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'delete')
  remove(@Param('id') id: string) {
    return this.poService.remove(id);
  }

  @Get('stats/tenant')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  stats(@Query('tenantId') tenantId: string) {
    return this.poService.getStats(tenantId);
  }
}
