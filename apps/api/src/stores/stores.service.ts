/**
 * ZYRA — Stores Service
 * Storefront CRUD, page management, theme management.
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { type Prisma, type PageType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateStoreDto {
  name: string;
  slug: string;
  tenantId: string;
  domain?: string;
  theme?: Record<string, unknown>;
}

export interface UpdateStoreDto {
  name?: string;
  slug?: string;
  description?: string;
  domain?: string;
  theme?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CreatePageDto {
  storeId: string;
  title: string;
  slug: string;
  type: string;
  content?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdatePageDto {
  title?: string;
  slug?: string;
  content?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
}

export interface CreateThemeDto {
  storeId: string;
  name: string;
  colors: Record<string, unknown>;
  fonts?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Storefront CRUD ──────────────────────────────────────────────────────────

  async findByTenant(tenantId: string) {
    return this.prisma.storefront.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const store = await this.prisma.storefront.findUnique({
      where: { id },
      include: { tenant: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async findBySlug(slug: string) {
    const store = await this.prisma.storefront.findFirst({
      where: { slug },
      include: { tenant: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async create(dto: CreateStoreDto) {
    const existing = await this.prisma.storefront.findFirst({
      where: { tenantId: dto.tenantId, slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('A store with this slug already exists for your tenant');
    }
    const themeJson = dto.theme ? JSON.parse(JSON.stringify(dto.theme)) : undefined;
    return this.prisma.storefront.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        tenantId: dto.tenantId,
        subdomain: dto.domain,
        theme: themeJson,
      },
      include: { tenant: true },
    });
  }

  async update(id: string, dto: UpdateStoreDto) {
    await this.findById(id);
    const data: Prisma.StorefrontUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.domain !== undefined ? { subdomain: dto.domain } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    if (dto.theme !== undefined) {
      (data as Record<string, unknown>).theme = JSON.parse(JSON.stringify(dto.theme));
    }
    return this.prisma.storefront.update({
      where: { id },
      data,
      include: { tenant: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.storefront.delete({ where: { id } });
  }

  // ── Pages ────────────────────────────────────────────────────────────────────

  async findPages(storeId: string) {
    await this.findById(storeId);
    return this.prisma.page.findMany({
      where: { storefrontId: storeId },
      orderBy: { createdAt: 'asc' },
      include: { storefront: true },
    });
  }

  async findPage(storeId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storefrontId: storeId },
      include: { storefront: true },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async createPage(storeId: string, dto: CreatePageDto) {
    await this.findById(storeId);
    const schemaJson = dto.content ? JSON.parse(JSON.stringify({ content: dto.content })) : undefined;
    return this.prisma.page.create({
      data: {
        storefrontId: storeId,
        tenantId: dto.storeId,
        title: dto.title,
        slug: dto.slug,
        type: dto.type as PageType,
        schema: schemaJson,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
      include: { storefront: true },
    });
  }

  async updatePage(storeId: string, pageId: string, dto: UpdatePageDto) {
    await this.findPage(storeId, pageId);
    const data: Record<string, unknown> = { ...dto };
    if (dto.content !== undefined) {
      data.schema = JSON.parse(JSON.stringify({ content: dto.content }));
      delete (data as Record<string, unknown>).content;
    }
    return this.prisma.page.update({
      where: { id: pageId },
      data,
      include: { storefront: true },
    });
  }

  async publishPage(storeId: string, pageId: string, publish: boolean) {
    await this.findPage(storeId, pageId);
    return this.prisma.page.update({
      where: { id: pageId },
      data: { isPublished: publish },
      include: { storefront: true },
    });
  }

  // ── Themes ──────────────────────────────────────────────────────────────────

  async findThemes(storeId: string) {
    await this.findById(storeId);
    return this.prisma.theme.findMany({
      where: { storefrontId: storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrUpdateTheme(storeId: string, dto: CreateThemeDto) {
    await this.findById(storeId);
    const existing = await this.prisma.theme.findFirst({
      where: { storefrontId: storeId, name: dto.name },
    });

    const colorsJson = JSON.parse(JSON.stringify(dto.colors));
    const fontsJson = dto.fonts ? JSON.parse(JSON.stringify(dto.fonts)) : undefined;
    const layoutJson = dto.layout ? JSON.parse(JSON.stringify(dto.layout)) : undefined;

    if (existing) {
      const updateData: Record<string, unknown> = {
        colors: colorsJson,
        isActive: true,
      };
      if (fontsJson) updateData.fonts = fontsJson;
      if (layoutJson) updateData.layout = layoutJson;

      return this.prisma.theme.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return this.prisma.theme.create({
      data: {
        tenantId: dto.storeId,
        storefrontId: storeId,
        name: dto.name,
        colors: colorsJson,
        fonts: fontsJson,
        layout: layoutJson,
        isActive: true,
      },
    });
  }
}
