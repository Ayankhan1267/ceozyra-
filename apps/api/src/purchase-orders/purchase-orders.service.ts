/**
 * ZYRA — Purchase Orders Service
 * Full lifecycle: create, update, receive, cancel, stats.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { InventoryService } from '../inventory/inventory.service';

export interface CreatePurchaseOrderDto {
  tenantId: string;
  supplierId: string;
  items: Array<{ productId: string; variantId?: string; quantity: number; unitCost: number }>;
  expectedDelivery?: string;
  notes?: string;
}

export interface UpdatePurchaseOrderDto {
  status?: string;
  expectedDelivery?: string;
  notes?: string;
  items?: Array<{ productId: string; variantId?: string; quantity: number; unitCost: number }>;
}

export interface POFilter {
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
    private readonly inventoryService: InventoryService,
  ) {}

  async list(tenantId: string, filter: POFilter) {
    const where: Record<string, unknown> = { tenantId };

    if (filter.status) {
      (where as Record<string, unknown>).status = filter.status;
    }
    if (filter.supplierId) {
      (where as Record<string, unknown>).supplierId = filter.supplierId;
    }
    if (filter.dateFrom || filter.dateTo) {
      (where as Record<string, unknown>).createdAt = {};
      if (filter.dateFrom) (where.createdAt as Record<string, Date>)['gte'] = new Date(filter.dateFrom);
      if (filter.dateTo) (where.createdAt as Record<string, Date>)['lte'] = new Date(filter.dateTo);
    }

    const skip = (filter.page - 1) * filter.limit;
    const [pos, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      purchaseOrders: pos,
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  async findById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async create(dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!supplier.isActive) {
      throw new BadRequestException('Cannot create PO for inactive supplier');
    }

    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

    const po = await this.prisma.purchaseOrder.create({
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

    this.eventService.emit('purchaseOrder.created', {
      purchaseOrderId: po.id,
      supplierId: dto.supplierId,
      tenantId: dto.tenantId,
    });
    return po;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.findById(id);

    if (existing.status === 'RECEIVED') {
      throw new BadRequestException('Cannot update a received purchase order');
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled purchase order');
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.expectedDelivery) {
      data.expectedDelivery = new Date(dto.expectedDelivery);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data,
      include: { supplier: true },
    });

    this.eventService.emit('purchaseOrder.updated', { purchaseOrderId: id });
    return updated;
  }

  async receive(id: string) {
    const po = await this.findById(id);

    if (po.status === 'RECEIVED') {
      throw new BadRequestException('Purchase order already received');
    }
    if (po.status === 'CANCELLED') {
      throw new BadRequestException('Cannot receive a cancelled purchase order');
    }

    const items = po.items as Array<{ productId: string; variantId?: string; quantity: number }>;

    for (const item of items) {
      const invItem = await this.prisma.inventoryItem.findFirst({
        where: {
          tenantId: po.tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
        },
      });

      if (invItem) {
        const balanceBefore = invItem.quantity;
        const balanceAfter = balanceBefore + item.quantity;

        await this.prisma.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: balanceAfter },
        });

        await this.prisma.stockMovement.create({
          data: {
            tenantId: po.tenantId,
            inventoryItemId: invItem.id,
            type: 'PURCHASE',
            quantity: item.quantity,
            balanceAfter,
            reason: `PO ${id} received`,
            referenceId: id,
            referenceType: 'PURCHASE_ORDER',
          },
        });
      } else {
        await this.prisma.inventoryItem.create({
          data: {
            tenantId: po.tenantId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            lowStockThreshold: 5,
          },
        });
      }
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED', receivedAt: new Date() },
      include: { supplier: true },
    });

    this.eventService.emit('purchaseOrder.received', {
      purchaseOrderId: id,
      supplierId: po.supplierId,
      tenantId: po.tenantId,
      itemCount: items.length,
    });

    return updated;
  }

  async cancel(id: string) {
    const po = await this.findById(id);

    if (po.status === 'RECEIVED') {
      throw new BadRequestException('Cannot cancel a received purchase order');
    }
    if (po.status === 'CANCELLED') {
      throw new BadRequestException('Purchase order already cancelled');
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { supplier: true },
    });

    this.eventService.emit('purchaseOrder.cancelled', { purchaseOrderId: id });
    return updated;
  }

  async remove(id: string) {
    const po = await this.findById(id);
    if (po.status !== 'DRAFT' && po.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Cannot delete PO with status "${po.status}". Cancel it first.`
      );
    }

    await this.prisma.purchaseOrder.delete({ where: { id } });
    this.eventService.emit('purchaseOrder.deleted', { purchaseOrderId: id });
    return { success: true };
  }

  async getStats(tenantId: string) {
    const [
      totalPOs,
      draftPOs,
      orderedPOs,
      receivedPOs,
      cancelledPOs,
      totalSpend,
    ] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { tenantId } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'ORDERED' } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'RECEIVED' } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'CANCELLED' } }),
      this.prisma.purchaseOrder.aggregate({
        where: { tenantId, status: 'RECEIVED' },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      total: totalPOs,
      draft: draftPOs,
      ordered: orderedPOs,
      received: receivedPOs,
      cancelled: cancelledPOs,
      pending: draftPOs + orderedPOs,
      totalSpend: totalSpend._sum.totalAmount || 0,
    };
  }
}
