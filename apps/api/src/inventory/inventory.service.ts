/**
 * ZYRA — Inventory Service
 * Stock tracking, low-stock alerts, suppliers, and purchase orders.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateInventoryItemDto {
  tenantId: string;
  productId: string;
  variantId?: string;
  quantity?: number;
  lowStockThreshold?: number;
  location?: string;
}

export interface UpdateInventoryDto {
  quantity?: number;
  reservedQuantity?: number;
  lowStockThreshold?: number;
  location?: string;
}

export interface StockAdjustmentDto {
  type: StockMovementType;
  quantity: number;
  reason?: string;
  referenceId?: string;
  notes?: string;
}

export interface CreateSupplierDto {
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  paymentTerms?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  paymentTerms?: string;
  isActive?: boolean;
}

export interface CreatePurchaseOrderDto {
  tenantId: string;
  supplierId: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitCost: number;
  }>;
  expectedDelivery?: string;
  notes?: string;
}

export interface UpdatePurchaseOrderDto {
  status?: string;
  expectedDelivery?: string;
  notes?: string;
}

export interface AcknowledgeAlertDto {
  acknowledged: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── Inventory Items ──────────────────────────────────────────────────────────

  async findByTenant(tenantId: string, productId?: string) {
    const where: Prisma.InventoryItemWhereInput = { tenantId };
    if (productId) where.productId = productId;

    return this.prisma.inventoryItem.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, slug: true, images: true } },
        variant: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, slug: true, images: true } },
        variant: { select: { id: true, name: true } },
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async findByProduct(tenantId: string, productId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId, productId },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        variant: { select: { id: true, name: true } },
      },
    });
  }

  async upsert(dto: CreateInventoryItemDto) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId: dto.tenantId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
      },
    });

    if (existing) {
      return this.prisma.inventoryItem.update({
        where: { id: existing.id },
        data: {
          quantity: dto.quantity ?? existing.quantity,
          lowStockThreshold: dto.lowStockThreshold ?? existing.lowStockThreshold,
          location: dto.location ?? existing.location,
        },
        include: { product: true, variant: true },
      });
    }

    return this.prisma.inventoryItem.create({
      data: {
        tenantId: dto.tenantId,
        productId: dto.productId,
        variantId: dto.variantId,
        quantity: dto.quantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        location: dto.location,
      },
      include: { product: true, variant: true },
    });
  }

  async update(id: string, dto: UpdateInventoryDto) {
    const item = await this.findById(id);
    return this.prisma.inventoryItem.update({
      where: { id },
      data: dto,
      include: { product: true, variant: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.inventoryItem.delete({ where: { id } });
  }

  // ── Stock Movements ──────────────────────────────────────────────────────────

  async adjustStock(id: string, dto: StockAdjustmentDto) {
    const item = await this.findById(id);

    const balanceBefore = item.quantity;
    const balanceAfter = balanceBefore + dto.quantity;

    if (balanceAfter < 0) {
      throw new BadRequestException(
        `Insufficient stock: current ${balanceBefore}, attempted ${dto.quantity}`
      );
    }

    const movement = await this.prisma.stockMovement.create({
      data: {
        tenantId: item.tenantId,
        inventoryItemId: id,
        type: dto.type,
        quantity: dto.quantity,
        balanceAfter,
        reason: dto.reason,
        referenceId: dto.referenceId,
        notes: dto.notes,
      },
    });

    await this.prisma.inventoryItem.update({
      where: { id },
      data: { quantity: balanceAfter },
    });

    // Check for low stock
    if (balanceAfter <= item.lowStockThreshold) {
      await this._maybeCreateAlert(item, balanceAfter);
    }

    this.eventService.emit('inventory.adjusted', {
      inventoryItemId: id,
      productId: item.productId,
      type: dto.type,
      quantity: dto.quantity,
      balanceAfter,
      tenantId: item.tenantId,
    });

    return movement;
  }

  async getMovements(tenantId: string, inventoryItemId?: string) {
    const where: Prisma.StockMovementWhereInput = { tenantId };
    if (inventoryItemId) where.inventoryItemId = inventoryItemId;

    return this.prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Low Stock Alerts ─────────────────────────────────────────────────────────

  async getAlerts(tenantId: string, status?: string) {
    const where: Prisma.LowStockAlertWhereInput = { tenantId };
    if (status) where.status = status as any;

    return this.prisma.lowStockAlert.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, slug: true, images: true } },
        inventoryItem: { select: { id: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeAlert(tenantId: string, alertId: string) {
    const alert = await this.prisma.lowStockAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.lowStockAlert.update({
      where: { id: alertId },
      data: { acknowledgedAt: new Date() },
    });
  }

  async resolveAlert(tenantId: string, alertId: string) {
    const alert = await this.prisma.lowStockAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.lowStockAlert.update({
      where: { id: alertId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  private async _maybeCreateAlert(item: any, currentQty: number) {
    const existing = await this.prisma.lowStockAlert.findFirst({
      where: {
        inventoryItemId: item.id,
        status: 'ACTIVE',
      },
    });

    if (existing) return;

    await this.prisma.lowStockAlert.create({
      data: {
        tenantId: item.tenantId,
        inventoryItemId: item.id,
        productId: item.productId,
        currentQuantity: currentQty,
        threshold: item.lowStockThreshold,
        status: 'ACTIVE',
      },
    });
  }

  // ── Suppliers ────────────────────────────────────────────────────────────────

  async getSuppliers(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: dto,
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.getSupplier(id);
    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSupplier(id: string) {
    await this.getSupplier(id);
    return this.prisma.supplier.delete({ where: { id } });
  }

  // ── Purchase Orders ──────────────────────────────────────────────────────────

  async getPurchaseOrders(tenantId: string, supplierId?: string) {
    const where: Prisma.PurchaseOrderWhereInput = { tenantId };
    if (supplierId) where.supplierId = supplierId;

    return this.prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPurchaseOrder(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId: dto.tenantId,
        supplierId: dto.supplierId,
        items: dto.items as any,
        totalAmount,
        expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : undefined,
        notes: dto.notes,
        status: 'DRAFT',
      },
      include: { supplier: true },
    });
  }

  async updatePurchaseOrder(id: string, dto: UpdatePurchaseOrderDto) {
    await this.getPurchaseOrder(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.expectedDelivery) {
      data.expectedDelivery = new Date(dto.expectedDelivery);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data,
      include: { supplier: true },
    });

    if (dto.status === 'RECEIVED') {
      // When a PO is received, update inventory
      const items = updated.items as Array<{ productId: string; variantId?: string; quantity: number }>;
      for (const item of items) {
        const invItem = await this.prisma.inventoryItem.findFirst({
          where: {
            tenantId: updated.tenantId,
            productId: item.productId,
            variantId: item.variantId ?? null,
          },
        });

        if (invItem) {
          await this.prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { increment: item.quantity } },
          });

          await this.prisma.stockMovement.create({
            data: {
              tenantId: updated.tenantId,
              inventoryItemId: invItem.id,
              type: 'PURCHASE',
              quantity: item.quantity,
              balanceAfter: invItem.quantity + item.quantity,
              reason: `Purchase order ${updated.id}`,
              referenceId: updated.id,
              referenceType: 'PURCHASE_ORDER',
            },
          });
        }
      }

      await this.prisma.purchaseOrder.update({
        where: { id },
        data: { receivedAt: new Date() },
      });
    }

    return updated;
  }

  async deletePurchaseOrder(id: string) {
    await this.getPurchaseOrder(id);
    return this.prisma.purchaseOrder.delete({ where: { id } });
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const [
      totalItems,
      lowStockCount,
      totalValue,
      pendingPOs,
      supplierCount,
    ] = await Promise.all([
      this.prisma.inventoryItem.count({ where: { tenantId } }),
      this.prisma.lowStockAlert.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.inventoryItem.aggregate({
        where: { tenantId },
        _sum: { quantity: true },
      }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: { not: 'RECEIVED' } } }),
      this.prisma.supplier.count({ where: { tenantId, isActive: true } }),
    ]);

    return {
      totalItems,
      lowStockAlerts: lowStockCount,
      totalStockUnits: totalValue._sum.quantity || 0,
      pendingPurchaseOrders: pendingPOs,
      activeSuppliers: supplierCount,
    };
  }
}
