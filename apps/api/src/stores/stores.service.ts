/**
 * ZYRA — Stores Service
 * Storefront CRUD, page management, theme management, page section builder.
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { type Prisma, type PageType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CreateSectionDto,
  UpdateSectionDto,
  ReorderSectionsDto,
  DuplicatePageDto,
  PageSectionResponse,
  PagePreviewResponse,
  DuplicatePageResponse,
} from './dto/page-section.dto';

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
      data: {
        isPublished: publish,
        publishedAt: publish ? new Date() : null,
      },
      include: { storefront: true },
    });
  }

  // ── Page Sections ────────────────────────────────────────────────────────────

  async addPageSection(pageId: string, storeId: string, dto: CreateSectionDto): Promise<PageSectionResponse> {
    await this.findPage(storeId, pageId);

    // Determine the next order value
    const lastSection = await this.prisma.pageSection.findFirst({
      where: { pageId },
      orderBy: { order: 'desc' },
    });
    const nextOrder = (lastSection?.order ?? -1) + 1;
    const order = dto.order ?? nextOrder;

    const section = await this.prisma.pageSection.create({
      data: {
        pageId,
        type: dto.type,
        content: dto.content ? JSON.parse(JSON.stringify(dto.content)) : undefined,
        order,
      },
    });

    return mapSection(section);
  }

  async updatePageSection(
    pageId: string,
    sectionId: string,
    storeId: string,
    dto: UpdateSectionDto,
  ): Promise<PageSectionResponse> {
    await this.findPage(storeId, pageId);

    const existing = await this.prisma.pageSection.findFirst({
      where: { id: sectionId, pageId },
    });
    if (!existing) throw new NotFoundException('Section not found');

    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.content !== undefined) data.content = JSON.parse(JSON.stringify(dto.content));
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.pageSection.update({
      where: { id: sectionId },
      data,
    });

    return mapSection(updated);
  }

  async removePageSection(pageId: string, sectionId: string, storeId: string): Promise<void> {
    await this.findPage(storeId, pageId);

    const existing = await this.prisma.pageSection.findFirst({
      where: { id: sectionId, pageId },
    });
    if (!existing) throw new NotFoundException('Section not found');

    await this.prisma.pageSection.delete({ where: { id: sectionId } });
  }

  async reorderPageSections(
    pageId: string,
    storeId: string,
    dto: ReorderSectionsDto,
  ): Promise<PageSectionResponse[]> {
    await this.findPage(storeId, pageId);

    // Validate all sections belong to this page
    const existingSections = await this.prisma.pageSection.findMany({
      where: { pageId },
      select: { id: true },
    });
    const existingIds = new Set(existingSections.map((s) => s.id));
    const invalidIds = dto.sectionIds.filter((id) => !existingIds.has(id));
    if (invalidIds.length > 0) {
      throw new NotFoundException(`Sections not found on this page: ${invalidIds.join(', ')}`);
    }

    // Update orders in a transaction
    await this.prisma.$transaction(
      dto.sectionIds.map((id, index) =>
        this.prisma.pageSection.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    return this.getPageSections(pageId);
  }

  async getPageSections(pageId: string): Promise<PageSectionResponse[]> {
    const sections = await this.prisma.pageSection.findMany({
      where: { pageId },
      orderBy: { order: 'asc' },
    });
    return sections.map(mapSection);
  }

  async duplicatePage(pageId: string, storeId: string, dto: DuplicatePageDto): Promise<DuplicatePageResponse> {
    const sourcePage = await this.findPage(storeId, pageId);

    // Build unique slug
    const baseSlug = dto.slug || `${sourcePage.slug}-copy`;
    const timestamp = Date.now().toString(36);
    const uniqueSlug = `${baseSlug}-${timestamp}`;

    // Fetch all source sections
    const sections = await this.prisma.pageSection.findMany({
      where: { pageId },
      orderBy: { order: 'asc' },
    });

    // Create new page with sections in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const newPage = await tx.page.create({
        data: {
          storefrontId: sourcePage.storefrontId,
          tenantId: sourcePage.tenantId,
          title: dto.title || `${sourcePage.title} (Copy)`,
          slug: uniqueSlug,
          type: sourcePage.type,
          schema: sourcePage.schema ? JSON.parse(JSON.stringify(sourcePage.schema)) : undefined,
          seoTitle: sourcePage.seoTitle,
          seoDescription: sourcePage.seoDescription,
          isPublished: false,
          sections: {
            create: sections.map((s) => ({
              type: s.type,
              content: s.content ? JSON.parse(JSON.stringify(s.content)) : undefined,
              order: s.order,
              isActive: s.isActive,
            })),
          },
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return newPage;
    });

    return {
      id: result.id,
      title: result.title,
      slug: result.slug,
      type: result.type,
      isPublished: result.isPublished,
      sections: result.sections.map(mapSection),
    };
  }

  async getPagePreview(pageId: string, storeId: string): Promise<PagePreviewResponse> {
    const page = await this.findPage(storeId, pageId);

    const sections = await this.prisma.pageSection.findMany({
      where: { pageId },
      orderBy: { order: 'asc' },
    });

    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      type: page.type,
      status: page.status,
      isPublished: page.isPublished,
      storefrontId: page.storefrontId,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      sections: sections.map(mapSection),
    };
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSection(section: {
  id: string;
  pageId: string;
  type: string;
  content: Record<string, unknown> | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PageSectionResponse {
  return {
    id: section.id,
    pageId: section.pageId,
    type: section.type,
    content: section.content ?? null,
    order: section.order,
    isActive: section.isActive,
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
  };
}
