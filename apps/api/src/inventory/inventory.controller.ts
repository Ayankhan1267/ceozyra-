/**
 * ZYRA — Inventory Controller
 * Stock tracking, low-stock alerts, suppliers, and purchase orders.
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
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Inventory Items ─────────────────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  findByTenant(@Query('tenantId') tenantId: string, @Query('productId') productId?: string) {
    return this.inventoryService.findByTenant(tenantId, productId);
  }

  @Get('product/:productId')
  findByProduct(@Query('tenantId') tenantId: string, @Param('productId') productId: string) {
    return this.inventoryService.findByProduct(tenantId, productId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'create')
  create(@Body() dto: any) {
    return this.inventoryService.upsert(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.inventoryService.update(id, dto);
  }

  @Post(':id/adjust')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  adjustStock(@Param('id') id: string, @Body() dto: any) {
    return this.inventoryService.adjustStock(id, dto);
  }

  @Get(':id/movements')
  getMovements(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.inventoryService.getMovements(tenantId, id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'delete')
  delete(@Param('id') id: string) {
    return this.inventoryService.delete(id);
  }

  // ── Low Stock Alerts ────────────────────────────────────────────────────────

  @Get('alerts')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  getAlerts(@Query('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.inventoryService.getAlerts(tenantId, status);
  }

  @Post('alerts/:alertId/acknowledge')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  acknowledgeAlert(@Query('tenantId') tenantId: string, @Param('alertId') alertId: string) {
    return this.inventoryService.acknowledgeAlert(tenantId, alertId);
  }

  @Post('alerts/:alertId/resolve')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  resolveAlert(@Query('tenantId') tenantId: string, @Param('alertId') alertId: string) {
    return this.inventoryService.resolveAlert(tenantId, alertId);
  }

  // ── Suppliers ───────────────────────────────────────────────────────────────

  @Get('suppliers')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  getSuppliers(@Query('tenantId') tenantId: string) {
    return this.inventoryService.getSuppliers(tenantId);
  }

  @Get('suppliers/:id')
  getSupplier(@Param('id') id: string) {
    return this.inventoryService.getSupplier(id);
  }

  @Post('suppliers')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'create')
  createSupplier(@Body() dto: any) {
    return this.inventoryService.createSupplier(dto);
  }

  @Patch('suppliers/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  updateSupplier(@Param('id') id: string, @Body() dto: any) {
    return this.inventoryService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'delete')
  deleteSupplier(@Param('id') id: string) {
    return this.inventoryService.deleteSupplier(id);
  }

  // ── Purchase Orders ─────────────────────────────────────────────────────────

  @Get('purchase-orders')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  getPurchaseOrders(@Query('tenantId') tenantId: string, @Query('supplierId') supplierId?: string) {
    return this.inventoryService.getPurchaseOrders(tenantId, supplierId);
  }

  @Get('purchase-orders/:id')
  getPurchaseOrder(@Param('id') id: string) {
    return this.inventoryService.getPurchaseOrder(id);
  }

  @Post('purchase-orders')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'create')
  createPurchaseOrder(@Body() dto: any) {
    return this.inventoryService.createPurchaseOrder(dto);
  }

  @Patch('purchase-orders/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'update')
  updatePurchaseOrder(@Param('id') id: string, @Body() dto: any) {
    return this.inventoryService.updatePurchaseOrder(id, dto);
  }

  @Delete('purchase-orders/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'delete')
  deletePurchaseOrder(@Param('id') id: string) {
    return this.inventoryService.deletePurchaseOrder(id);
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  @Get('stats')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('inventory', 'read')
  getStats(@Query('tenantId') tenantId: string) {
    return this.inventoryService.getStats(tenantId);
  }
}
