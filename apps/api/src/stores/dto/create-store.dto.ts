/**
 * ZYRA — Stores DTOs
 */

export interface CreateStoreDto {
  name: string;
  slug: string;
  tenantId: string;
  description?: string;
  theme?: Record<string, unknown>;
  domain?: string;
}

export interface UpdateStoreDto {
  name?: string;
  description?: string;
  theme?: Record<string, unknown>;
  domain?: string;
  isActive?: boolean;
}

export interface CreatePageDto {
  storeId: string;
  type: string;
  title: string;
  slug: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  sortOrder?: number;
}

export interface UpdatePageDto {
  title?: string;
  slug?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  sortOrder?: number;
}

export interface CreateThemeDto {
  storeId: string;
  name: string;
  colors: Record<string, string>;
  fonts?: Record<string, string>;
  layout?: Record<string, unknown>;
}
