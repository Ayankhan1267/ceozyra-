/**
 * ZYRA — Suppliers Controller
 * REST endpoints for supplier management.
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
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  list(
    @Query('tenantId') tenantId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.suppliersService.list(tenantId, {
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'create')
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.suppliersService.create({ ...dto, tenantId } as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'delete')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.suppliersService.getStats(id);
  }

  @Get(':id/purchase-orders')
  getPurchaseOrders(
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.suppliersService.findById(id).then((s) => {
      let pos = s.purchaseOrders;
      if (status) pos = pos.filter((po) => po.status === status);
      return pos;
    });
  }
}
