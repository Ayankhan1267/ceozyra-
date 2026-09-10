/**
 * ZYRA — Product Service
 * Full CRUD for Products, Variants, Categories, and Collections.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateProductDto {
  tenantId: string;
  storefrontId: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  images: string[];
  categoryId?: string;
  category?: string;
  tags?: string[];
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  variants?: Array<{
    name: string;
    sku?: string;
    price: number;
    inventory: number;
    attributes?: Record<string, unknown>;
  }>;
}

export interface UpdateProductDto {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  cost?: number;
  images?: string[];
  categoryId?: string;
  category?: string;
  tags?: string[];
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

// DTOs exported for the discounts controller
export interface DiscountBaseDto {
  name: string;
  type: string;
  value: number;
  tenantId: string;
  storefrontId?: string;
  minOrderValue?: number;
  maxUses?: number;
  startsAt?: Date;
  endsAt?: Date;
}
export type CreateDiscountDto = DiscountBaseDto;
export type UpdateDiscountDto = {
  name?: string;
  type?: string;
  value?: number;
  minOrderValue?: number;
  maxUses?: number;
  startsAt?: Date;
  endsAt?: Date;
  isActive?: boolean;
};
export type CreateCouponDto = {
  code: string;
  discountId: string;
  maxUsesPerCustomer?: number;
  startsAt?: Date;
  endsAt?: Date;
};
export type UpdateCouponDto = {
  code?: string;
  discountId?: string;
  maxUsesPerCustomer?: number;
  startsAt?: Date;
  endsAt?: Date;
  isActive?: boolean;
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── Products ────────────────────────────────────────────────────────────────

  async listProducts(params: {
    tenantId?: string;
    storefrontId?: string;
    page?: number;
    limit?: number;
    categoryId?: string;
    search?: string;
    isActive?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.storefrontId) where.storefrontId = params.storefrontId;
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.isActive === 'true') where.isActive = true;
    else if (params.isActive === 'false') where.isActive = false;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' as const } },
        { slug: { contains: params.search, mode: 'insensitive' as const } },
        { description: { contains: params.search, mode: 'insensitive' as const } },
      ];
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    const { variants, ...productData } = dto;

    const product = await this.prisma.product.create({
      data: {
        tenantId: dto.tenantId,
        storefrontId: dto.storefrontId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        cost: dto.cost,
        images: dto.images,
        categoryId: dto.categoryId,
        category: dto.category,
        tags: dto.tags ?? [],
        isActive: dto.isActive ?? true,
        metadata: dto.metadata as never,
        variants: variants?.length
          ? {
              create: variants.map((v) => ({
                name: v.name,
                sku: v.sku,
                price: v.price,
                inventory: v.inventory,
                attributes: v.attributes as never,
              })),
            }
          : undefined,
      },
      include: { variants: true },
    });

    this.eventService.emit('product.created', {
      productId: product.id,
      tenantId: dto.tenantId,
    });

    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    const data: Record<string, unknown> = { ...dto };
    if (data.metadata) data.metadata = data.metadata as never;

    const updated = await this.prisma.product.update({
      where: { id },
      data,
      include: { variants: true },
    });

    this.eventService.emit('product.updated', {
      productId: id,
      tenantId: product.tenantId ?? '',
    });

    return updated;
  }

  async softDeleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    this.eventService.emit('product.deleted', {
      productId: id,
      tenantId: product.tenantId ?? '',
    });

    return { success: true };
  }

  async createVariant(productId: string, dto: {
    name: string;
    sku?: string;
    price: number;
    inventory: number;
    attributes?: Record<string, unknown>;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name,
        sku: dto.sku,
        price: dto.price,
        inventory: dto.inventory,
        attributes: dto.attributes as never,
      },
    });
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async listCategories(storefrontId: string) {
    return this.prisma.category.findMany({
      where: { storefrontId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(data: {
    storefrontId: string;
    name: string;
    slug: string;
    description?: string;
    image?: string;
  }) {
    return this.prisma.category.create({
      data: {
        storefrontId: data.storefrontId,
        name: data.name,
        slug: data.slug,
      },
    });
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; image?: string }) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  // ── Collections ─────────────────────────────────────────────────────────────

  async listCollections(storefrontId: string) {
    return this.prisma.collection.findMany({
      where: { storefrontId },
      include: { products: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findCollectionById(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  async createCollection(data: {
    tenantId: string;
    storefrontId: string;
    name: string;
    slug: string;
    description?: string;
    image?: string;
    featured?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.collection.create({
      data: {
        tenantId: data.tenantId,
        storefrontId: data.storefrontId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        image: data.image,
        featured: data.featured ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
      include: { products: true },
    });
  }

  async updateCollection(id: string, data: {
    name?: string;
    slug?: string;
    description?: string;
    image?: string;
    featured?: boolean;
    sortOrder?: number;
    productIds?: string[];
  }) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundException('Collection not found');

    const updateData: Record<string, unknown> = { ...data };

    if (data.productIds) {
      updateData.products = {
        set: data.productIds.map((pid) => ({ id: pid })),
      };
      delete (updateData as Record<string, unknown>).productIds;
    }

    return this.prisma.collection.update({
      where: { id },
      data: updateData,
      include: { products: true },
    });
  }

  async deleteCollection(id: string) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundException('Collection not found');

    await this.prisma.collection.update({
      where: { id },
      data: { products: { set: [] } },
    });

    await this.prisma.collection.delete({ where: { id } });
    return { success: true };
  }

  // ── Discounts & Coupons ─────────────────────────────────────────────────────
  // Stubs — Discount / Coupon models not yet in the Prisma schema.

  async createDiscount(data: CreateDiscountDto) {
    throw new BadRequestException('Discount model not yet implemented in schema');
  }

  async listDiscounts() {
    return [];
  }

  async createCoupon(_data: Record<string, unknown>) {
    throw new BadRequestException('Coupon model not yet implemented in schema');
  }

  async listCoupons() {
    return [];
  }

  async validateCoupon(_code: string, _tenantId?: string, _orderValue?: number) {
    return { valid: false, discount: 0 };
  }

  // ── Controller-facing wrappers ──────────────────────────────────────────────

  async getDiscounts(tenantId: string, _storefrontId?: string) {
    return [];
  }

  async updateDiscount(_id: string, data: UpdateDiscountDto) {
    throw new BadRequestException('Discount model not yet implemented in schema');
  }

  async deleteDiscount(_id: string) {
    return { success: true };
  }

  async getCoupons(_tenantId: string) {
    return [];
  }

  async updateCoupon(_id: string, _data: Record<string, unknown>) {
    throw new BadRequestException('Coupon model not yet implemented in schema');
  }

  async deleteCoupon(_id: string) {
    return { success: true };
  }

  // ── Controller-facing wrappers ──────────────────────────────────────────────

  async findByStorefront(storefrontId: string, params: { page?: number; limit?: number; categoryId?: string }) {
    const sf = await this.prisma.storefront.findUnique({
      where: { id: storefrontId },
      select: { tenantId: true },
    });
    if (!sf) return { products: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    return this.listProducts({ storefrontId, tenantId: sf.tenantId ?? '', ...params });
  }

  async findByTenant(tenantId: string, page = 1, limit = 20) {
    return this.listProducts({ tenantId, page, limit });
  }

  async search(q: string, tenantId?: string, storefrontId?: string) {
    if (!tenantId && !storefrontId) return { products: [], total: 0 };
    return this.listProducts({ tenantId: tenantId ?? '', storefrontId, search: q });
  }

  async create(dto: CreateProductDto) {
    return this.createProduct(dto);
  }

  async update(id: string, dto: UpdateProductDto) {
    return this.updateProduct(id, dto);
  }

  async delete(id: string) {
    return this.softDeleteProduct(id);
  }
}
