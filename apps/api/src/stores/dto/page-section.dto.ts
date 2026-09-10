/**
 * ZYRA — Page Section DTOs
 */

export interface CreateSectionDto {
  type: string;
  content: Record<string, unknown>;
  order?: number;
}

export interface UpdateSectionDto {
  type?: string;
  content?: Record<string, unknown>;
  order?: number;
  isActive?: boolean;
}

export interface ReorderSectionsDto {
  sectionIds: string[];
}

export interface DuplicatePageDto {
  title?: string;
  slug?: string;
}

export interface PageSectionResponse {
  id: string;
  pageId: string;
  type: string;
  content: Record<string, unknown> | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PagePreviewResponse {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  isPublished: boolean;
  storefrontId: string;
  seoTitle: string | null;
  seoDescription: string | null;
  sections: PageSectionResponse[];
}

export interface DuplicatePageResponse {
  id: string;
  title: string;
  slug: string;
  type: string;
  isPublished: boolean;
  sections: PageSectionResponse[];
}
