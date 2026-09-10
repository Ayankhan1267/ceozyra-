/**
 * ZYRA — Suppliers Service
 * Dedicated CRUD + stats for suppliers and related purchase orders.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { InventoryService } from '../inventory/inventory.service';

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

export interface SupplierFilter {
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
    private readonly inventoryService: InventoryService,
  ) {}

  async list(tenantId: string, filter: SupplierFilter) {
    const where: Record<string, unknown> = { tenantId };
    if (filter.search) {
      where.name = { contains: filter.search, mode: 'insensitive' };
    }
    if (filter.isActive !== undefined) {
      (where as Record<string, unknown>).isActive = filter.isActive;
    }

    const skip = (filter.page - 1) * filter.limit;
    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      suppliers,
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  async findById(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        contactPerson: dto.contactPerson,
        paymentTerms: dto.paymentTerms,
      },
    });

    this.eventService.emit('supplier.created', { supplierId: supplier.id, tenantId: dto.tenantId });
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findById(id);

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: dto,
    });

    this.eventService.emit('supplier.updated', { supplierId: id });
    return updated;
  }

  async remove(id: string) {
    const supplier = await this.findById(id);

    const poCount = await this.prisma.purchaseOrder.count({
      where: { supplierId: id, status: { not: 'CANCELLED' } },
    });
    if (poCount > 0) {
      throw new BadRequestException(
        `Cannot delete supplier with ${poCount} active purchase order(s). Cancel them first.`
      );
    }

    await this.prisma.supplier.delete({ where: { id } });
    this.eventService.emit('supplier.deleted', { supplierId: id });
    return { success: true };
  }

  async getStats(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const [
      totalPOs,
      pendingPOs,
      receivedPOs,
      totalSpend,
      avgDelivery,
    ] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { supplierId: id } }),
      this.prisma.purchaseOrder.count({ where: { supplierId: id, status: { not: 'CANCELLED' } } }),
      this.prisma.purchaseOrder.count({ where: { supplierId: id, status: 'RECEIVED' } }),
      this.prisma.purchaseOrder.aggregate({
        where: { supplierId: id, status: 'RECEIVED' },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { supplierId: id, status: 'RECEIVED', receivedAt: { not: null } },
        select: { expectedDelivery: true, receivedAt: true },
      }),
    ]);

    let avgDays: number | null = null;
    if (avgDelivery.length > 0) {
      const days = avgDelivery
        .filter((po) => po.expectedDelivery && po.receivedAt)
        .map((po) => {
          const expected = new Date(po.expectedDelivery!).getTime();
          const received = new Date(po.receivedAt!).getTime();
          return (received - expected) / (1000 * 60 * 60 * 24);
        });
      if (days.length > 0) avgDays = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    }

    return {
      totalOrders: totalPOs,
      pendingOrders: pendingPOs,
      receivedOrders: receivedPOs,
      cancelledOrders: totalPOs - pendingPOs,
      totalSpend: totalSpend._sum.totalAmount || 0,
      avgDeliveryDays: avgDays,
    };
  }
}
