'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Label, Textarea, Select } from '@zyra/ui';
import DashboardShell from '@/components/DashboardShell';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';
const STOREFRONT_ID = 'cmtsybnj5006srtzxnmka1abc';

// ─── Types ──────────────────────────────────────────────────────────────────────

type SectionType =
  | 'hero_banner'
  | 'product_grid'
  | 'product_carousel'
  | 'rich_text'
  | 'image_gallery'
  | 'video_embed'
  | 'contact_form'
  | 'testimonials'
  | 'faq'
  | 'features';

interface PageSection {
  id: string;
  pageId: string;
  type: SectionType;
  content: Record<string, unknown> | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StorePage {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  isPublished: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  isActive: boolean;
}

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

// ─── Section type config ────────────────────────────────────────────────────────

const SECTION_TYPES: { value: SectionType; label: string; icon: string; description: string }[] = [
  { value: 'hero_banner', label: 'Hero Banner', icon: '🎯', description: 'Full-width banner with heading, subtext and CTA button' },
  { value: 'product_grid', label: 'Product Grid', icon: '📦', description: 'Display products in a responsive grid layout' },
  { value: 'product_carousel', label: 'Product Carousel', icon: '🎠', description: 'Featured products slider carousel' },
  { value: 'rich_text', label: 'Rich Text', icon: '📝', description: 'Heading and paragraph text content' },
  { value: 'image_gallery', label: 'Image Gallery', icon: '🖼️', description: 'Multiple images in a grid layout' },
  { value: 'video_embed', label: 'Video Embed', icon: '▶️', description: 'YouTube or Vimeo video embed' },
  { value: 'contact_form', label: 'Contact Form', icon: '✉️', description: 'Name, email, and message contact form' },
  { value: 'testimonials', label: 'Testimonials', icon: '💬', description: 'Customer reviews carousel' },
  { value: 'faq', label: 'FAQ', icon: '❓', description: 'Accordion-style frequently asked questions' },
  { value: 'features', label: 'Features', icon: '⚡', description: 'Icon + title + description feature grid' },
];

// ─── Default section content ────────────────────────────────────────────────────

function getDefaultContent(type: SectionType): Record<string, unknown> {
  switch (type) {
    case 'hero_banner':
      return {
        heading: 'Welcome to Our Store',
        subtext: 'Discover amazing products at great prices.',
        image: '',
        ctaText: 'Shop Now',
        ctaLink: '/products',
        backgroundColor: '#4F46E5',
        textColor: '#FFFFFF',
        alignment: 'center',
      };
    case 'product_grid':
      return {
        title: 'Our Products',
        columns: 4,
        productIds: [],
        collectionId: '',
        categoryId: '',
        showPrices: true,
        limit: 8,
      };
    case 'product_carousel':
      return {
        title: 'Featured Products',
        productIds: [],
        collectionId: '',
        autoplay: true,
        autoplayInterval: 4000,
        showNavigation: true,
        itemsPerView: 3,
      };
    case 'rich_text':
      return {
        heading: 'About Us',
        paragraphs: ['We are a premium store offering the best products.', 'Our mission is to provide quality and value.'],
        alignment: 'left',
      };
    case 'image_gallery':
      return {
        images: [],
        columns: 3,
        gap: 'medium',
        borderRadius: true,
      };
    case 'video_embed':
      return {
        url: '',
        provider: 'youtube',
        aspectRatio: '16:9',
      };
    case 'contact_form':
      return {
        heading: 'Get in Touch',
        subtext: 'We would love to hear from you.',
        fields: ['name', 'email', 'message'],
        submitText: 'Send Message',
        backgroundColor: '#F8FAFC',
      };
    case 'testimonials':
      return {
        heading: 'What Our Customers Say',
        testimonials: [
          { name: 'Sarah M.', text: 'Amazing products and fast delivery!', rating: 5 },
          { name: 'John D.', text: 'Great quality and excellent customer service.', rating: 5 },
        ],
        autoplay: true,
        autoplayInterval: 5000,
      };
    case 'faq':
      return {
        heading: 'Frequently Asked Questions',
        items: [
          { question: 'How do I place an order?', answer: 'Browse our products and click "Add to Cart", then proceed to checkout.' },
          { question: 'What is your shipping policy?', answer: 'We offer free shipping on orders over $50. Standard delivery takes 3-5 business days.' },
        ],
      };
    case 'features':
      return {
        heading: 'Why Choose Us',
        features: [
          { icon: '🚚', title: 'Free Shipping', description: 'On all orders over $50' },
          { icon: '🔒', title: 'Secure Payment', description: '100% secure checkout' },
          { icon: '💯', title: 'Quality Guarantee', description: '30-day money back guarantee' },
        ],
        columns: 3,
      };
    default:
      return {};
  }
}

// ─── Section type label helper ──────────────────────────────────────────────────

function getSectionTypeLabel(type: string): string {
  return SECTION_TYPES.find((s) => s.value === type)?.label || type;
}

function getSectionTypeIcon(type: string): string {
  return SECTION_TYPES.find((s) => s.value === type)?.icon || '📄';
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function StoreBuilderPage() {
  // ─── State ──────────────────────────────────────────────────────────────────

  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [sections, setSections] = useState<PageSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<PageSection | null>(null);

  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageIsPublished, setPageIsPublished] = useState(false);
  const [pageStatus, setPageStatus] = useState('DRAFT');

  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal state
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [editingPageTitle, setEditingPageTitle] = useState('');
  const [editingPageSlug, setEditingPageSlug] = useState('');

  // Drag state
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Right panel tab
  const [rightTab, setRightTab] = useState<'content' | 'style'>('content');

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load pages ──────────────────────────────────────────────────────────────

  const loadPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: StorePage[] = await res.json();
      setPages(data);
      if (data.length > 0 && !selectedPageId) {
        selectPage(data[0]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load pages.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedPageId]);

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load products, collections, categories ──────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [pRes, cRes, catRes] = await Promise.all([
          fetch(`${API_BASE}/api/products/filter?tenantId=${TENANT_ID}&storefrontId=${STOREFRONT_ID}&limit=50`),
          fetch(`${API_BASE}/api/collections?storefrontId=${STOREFRONT_ID}`),
          fetch(`${API_BASE}/api/categories?storefrontId=${STOREFRONT_ID}`),
        ]);
        if (pRes.ok) {
          const d = await pRes.json();
          setProducts(Array.isArray(d.products) ? d.products : []);
        }
        if (cRes.ok) {
          setCollections(await cRes.json());
        }
        if (catRes.ok) {
          setCategories(await catRes.json());
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ─── Page selection ──────────────────────────────────────────────────────────

  const selectPage = async (page: StorePage) => {
    setSelectedPageId(page.id);
    setPageTitle(page.title);
    setPageSlug(page.slug);
    setPageIsPublished(page.isPublished);
    setPageStatus(page.status || 'DRAFT');
    setSelectedSectionId(null);
    setSelectedSection(null);
    await loadSections(page.id);
  };

  const loadSections = async (pageId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${pageId}/sections`);
      if (res.ok) {
        const data: PageSection[] = await res.json();
        setSections(data);
      }
    } catch { /* silent */ }
  };

  // ─── Page operations ─────────────────────────────────────────────────────────

  const openCreatePage = () => {
    setEditingPageTitle('');
    setEditingPageSlug('');
    setPageModalOpen(true);
  };

  const openEditPage = (page: StorePage) => {
    setEditingPageTitle(page.title);
    setEditingPageSlug(page.slug);
    setPageModalOpen(true);
  };

  const handleSavePageMeta = async () => {
    if (!selectedPageId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${selectedPageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pageTitle, slug: pageSlug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to save page');
      }
      showToast('success', 'Page updated.');
      loadPages();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save page.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePage = async () => {
    if (!editingPageTitle.trim() || !editingPageSlug.trim()) {
      showToast('error', 'Title and slug are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: TENANT_ID,
          title: editingPageTitle.trim(),
          slug: editingPageSlug.trim(),
          type: 'CUSTOM',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to create page');
      }
      showToast('success', 'Page created.');
      setPageModalOpen(false);
      loadPages();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create page.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Delete this page and all its sections? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${pageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete page');
      showToast('success', 'Page deleted.');
      setSelectedPageId(null);
      setSections([]);
      setSelectedSectionId(null);
      setSelectedSection(null);
      loadPages();
    } catch {
      showToast('error', 'Failed to delete page.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!selectedPageId) return;
    const newState = !pageIsPublished;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${selectedPageId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newState }),
      });
      if (!res.ok) throw new Error('Failed to toggle publish');
      setPageIsPublished(newState);
      setPageStatus(newState ? 'PUBLISHED' : 'DRAFT');
      showToast('success', newState ? 'Page published.' : 'Page unpublished.');
      loadPages();
    } catch {
      showToast('error', 'Failed to toggle publish status.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Section operations ──────────────────────────────────────────────────────

  const handleAddSection = async (type: SectionType) => {
    if (!selectedPageId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${selectedPageId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: getDefaultContent(type) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to add section');
      }
      const newSection: PageSection = await res.json();
      setSections((prev) => [...prev, newSection]);
      setSelectedSectionId(newSection.id);
      setSelectedSection(newSection);
      setSectionPickerOpen(false);
      showToast('success', 'Section added.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add section.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSection = async (sectionId: string, updates: Record<string, unknown>) => {
    if (!selectedPageId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${selectedPageId}/sections/${sectionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to update section');
      }
      const updated: PageSection = await res.json();
      setSections((prev) => prev.map((s) => (s.id === sectionId ? updated : s)));
      if (selectedSectionId === sectionId) {
        setSelectedSection(updated);
      }
    } catch {
      // Silently fail on auto-save to not interrupt user
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Remove this section?')) return;
    if (!selectedPageId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${selectedPageId}/sections/${sectionId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete section');
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(null);
        setSelectedSection(null);
      }
      showToast('success', 'Section removed.');
    } catch {
      showToast('error', 'Failed to remove section.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Drag and drop reorder ───────────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newOrder = [...sections];
    const [moved] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, moved);
    setSections(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Persist reorder
    if (!selectedPageId) return;
    try {
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${selectedPageId}/sections/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionIds: newOrder.map((s) => s.id) }),
      });
      if (!res.ok) {
        // Reload to get correct state
        loadSections(selectedPageId);
      }
    } catch {
      loadSections(selectedPageId);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // ─── Duplicate section ───────────────────────────────────────────────────────

  const handleDuplicateSection = async (section: PageSection) => {
    if (!selectedPageId) return;
    setSaving(true);
    try {
      const content = section.content ? { ...section.content } : getDefaultContent(section.type as SectionType);
      const res = await fetch(`${API_BASE}/api/stores/${STOREFRONT_ID}/pages/${selectedPageId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: section.type,
          content,
          order: section.order + 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to duplicate section');
      }
      const newSection: PageSection = await res.json();
      setSections((prev) => {
        const idx = prev.findIndex((s) => s.id === section.id);
        const updated = [...prev];
        updated.splice(idx + 1, 0, newSection);
        return updated;
      });
      showToast('success', 'Section duplicated.');
    } catch {
      showToast('error', 'Failed to duplicate section.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Preview ─────────────────────────────────────────────────────────────────

  const handlePreview = () => {
    if (!selectedPageId) return;
    const url = `/storefront/${STOREFRONT_ID}/${pageSlug}?preview=true`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ─── Content field updater ───────────────────────────────────────────────────

  const updateSectionContent = (sectionId: string, field: string, value: unknown) => {
    if (!selectedSection) return;
    const newContent = { ...selectedSection.content, [field]: value } as Record<string, unknown>;
    setSelectedSection({ ...selectedSection, content: newContent });
    // Update in state immediately for responsiveness
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, content: newContent } : s)));
    // Debounced API save
    handleUpdateSection(sectionId, { content: newContent });
  };

  const updateSectionContentBatch = (sectionId: string, fields: Record<string, unknown>) => {
    if (!selectedSection) return;
    const newContent = { ...selectedSection.content, ...fields } as Record<string, unknown>;
    setSelectedSection({ ...selectedSection, content: newContent });
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, content: newContent } : s)));
    handleUpdateSection(sectionId, { content: newContent });
  };

  // ─── Sidebar links ───────────────────────────────────────────────────────────

  const sidebarLinks = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/chat', label: 'Talk to ZYRA' },
    { href: '/dashboard/approvals', label: 'Approvals' },
    { href: '/dashboard/orders', label: 'Orders' },
    { href: '/dashboard/products', label: 'Products' },
    { href: '/dashboard/customers', label: 'Customers' },
    { href: '/dashboard/finance', label: 'Finance' },
    { href: '/dashboard/reports', label: 'Reports' },
    { href: '/dashboard/store-builder', label: 'Store Builder', active: true },
    { href: '/dashboard/storefront', label: 'Storefront' },
    { href: '/dashboard/crm', label: 'CRM' },
    { href: '/dashboard/leads', label: 'Leads' },
    { href: '/dashboard/companies', label: 'Companies' },
    { href: '/dashboard/pipeline', label: 'Pipeline' },
    { href: '/dashboard/segments', label: 'Segments' },
    { href: '/dashboard/tags', label: 'Tags' },
    { href: '/dashboard/conversations', label: 'Conversations' },
    { href: '/dashboard/messages', label: 'Messages' },
    { href: '/dashboard/templates', label: 'Templates' },
    { href: '/dashboard/campaigns', label: 'Campaigns' },
    { href: '/dashboard/automation', label: 'Automation' },
  ];

  // ══════════════════════════════════════════════════════════════════════════════
  //  RENDER — Section Editor
  // ══════════════════════════════════════════════════════════════════════════════

  const renderSectionEditor = () => {
    if (!selectedSection) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-20">
          <div className="text-5xl mb-4">🎨</div>
          <Heading as="h3" className="text-lg font-semibold text-slate-900">No section selected</Heading>
          <Text variant="muted" className="mt-2 max-w-sm">
            Select a section from the canvas to edit its properties, or add a new section to get started.
          </Text>
        </div>
      );
    }

    const content = selectedSection.content || {};
    const type = selectedSection.type;

    return (
      <div className="space-y-5">
        {/* Section type badge */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{getSectionTypeIcon(type)}</span>
          <Badge variant="info">{getSectionTypeLabel(type)}</Badge>
          <Badge variant={selectedSection.isActive ? 'success' : 'neutral'}>
            {selectedSection.isActive ? 'Active' : 'Hidden'}
          </Badge>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {[
            { key: 'content', label: 'Content' },
            { key: 'style', label: 'Style' },
            { key: 'settings', label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRightTab(tab.key as typeof rightTab)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                rightTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Content tab ─────────────────────────────────────────────────────── */}

        {rightTab === 'content' && (
          <div className="space-y-4">
            {type === 'hero_banner' && (
              <>
                <div>
                  <Label>Heading</Label>
                  <Input
                    value={(content.heading as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'heading', e.target.value)}
                    placeholder="Hero heading"
                  />
                </div>
                <div>
                  <Label>Subtext</Label>
                  <Textarea
                    value={(content.subtext as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'subtext', e.target.value)}
                    placeholder="Supporting text"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Image URL</Label>
                  <Input
                    value={(content.image as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'image', e.target.value)}
                    placeholder="https://example.com/hero.jpg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CTA Button Text</Label>
                    <Input
                      value={(content.ctaText as string) || ''}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'ctaText', e.target.value)}
                      placeholder="Shop Now"
                    />
                  </div>
                  <div>
                    <Label>CTA Link</Label>
                    <Input
                      value={(content.ctaLink as string) || ''}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'ctaLink', e.target.value)}
                      placeholder="/products"
                    />
                  </div>
                </div>
                <div>
                  <Label>Text Alignment</Label>
                  <Select
                    options={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                    ]}
                    value={(content.alignment as string) || 'center'}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'alignment', e.target.value)}
                  />
                </div>
              </>
            )}

            {type === 'product_grid' && (
              <>
                <div>
                  <Label>Section Title</Label>
                  <Input
                    value={(content.title as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'title', e.target.value)}
                    placeholder="Our Products"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Columns</Label>
                    <Select
                      options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                      value={String(content.columns || 4)}
                      onChange={(e) => updateSectionContentBatch(selectedSection.id, { columns: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Max Products</Label>
                    <Input
                      type="number"
                      value={String(content.limit || 8)}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'limit', parseInt(e.target.value) || 8)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Filter by Collection</Label>
                  <Select
                    options={[{ value: '', label: 'None' }, ...collections.map((c) => ({ value: c.id, label: c.name }))]}
                    value={(content.collectionId as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'collectionId', e.target.value || null)}
                  />
                </div>
                <div>
                  <Label>Filter by Category</Label>
                  <Select
                    options={[{ value: '', label: 'None' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                    value={(content.categoryId as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'categoryId', e.target.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showPrices"
                    checked={content.showPrices !== false}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'showPrices', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="showPrices" className="cursor-pointer">Show prices</Label>
                </div>
              </>
            )}

            {type === 'product_carousel' && (
              <>
                <div>
                  <Label>Section Title</Label>
                  <Input
                    value={(content.title as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'title', e.target.value)}
                    placeholder="Featured Products"
                  />
                </div>
                <div>
                  <Label>Filter by Collection</Label>
                  <Select
                    options={[{ value: '', label: 'None' }, ...collections.map((c) => ({ value: c.id, label: c.name }))]}
                    value={(content.collectionId as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'collectionId', e.target.value || null)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Items per view</Label>
                    <Input
                      type="number"
                      value={String(content.itemsPerView || 3)}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'itemsPerView', parseInt(e.target.value) || 3)}
                    />
                  </div>
                  <div>
                    <Label>Autoplay (ms)</Label>
                    <Input
                      type="number"
                      value={String(content.autoplayInterval || 4000)}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'autoplayInterval', parseInt(e.target.value) || 4000)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="carouselAutoplay"
                      checked={content.autoplay !== false}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'autoplay', e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <Label htmlFor="carouselAutoplay" className="cursor-pointer">Autoplay</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="carouselNav"
                      checked={content.showNavigation !== false}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'showNavigation', e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <Label htmlFor="carouselNav" className="cursor-pointer">Navigation arrows</Label>
                  </div>
                </div>
              </>
            )}

            {type === 'rich_text' && (
              <>
                <div>
                  <Label>Heading</Label>
                  <Input
                    value={(content.heading as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'heading', e.target.value)}
                    placeholder="Section heading"
                  />
                </div>
                <div>
                  <Label>Paragraphs (one per line)</Label>
                  <Textarea
                    value={Array.isArray(content.paragraphs) ? (content.paragraphs as string[]).join('\n') : ''}
                    onChange={(e) =>
                      updateSectionContent(
                        selectedSection.id,
                        'paragraphs',
                        e.target.value.split('\n').filter(Boolean)
                      )
                    }
                    placeholder="First paragraph\nSecond paragraph"
                    rows={6}
                  />
                </div>
                <div>
                  <Label>Alignment</Label>
                  <Select
                    options={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                    ]}
                    value={(content.alignment as string) || 'left'}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'alignment', e.target.value)}
                  />
                </div>
              </>
            )}

            {type === 'image_gallery' && (
              <>
                <div>
                  <Label>Image URLs (one per line)</Label>
                  <Textarea
                    value={Array.isArray(content.images) ? (content.images as string[]).join('\n') : ''}
                    onChange={(e) =>
                      updateSectionContent(
                        selectedSection.id,
                        'images',
                        e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="https://example.com/img1.jpg\nhttps://example.com/img2.jpg"
                    rows={8}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Columns</Label>
                    <Select
                      options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
                      value={String(content.columns || 3)}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'columns', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Gap</Label>
                    <Select
                      options={[
                        { value: 'small', label: 'Small' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'large', label: 'Large' },
                      ]}
                      value={(content.gap as string) || 'medium'}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'gap', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="galleryRadius"
                    checked={content.borderRadius !== false}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'borderRadius', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <Label htmlFor="galleryRadius" className="cursor-pointer">Rounded corners</Label>
                </div>
              </>
            )}

            {type === 'video_embed' && (
              <>
                <div>
                  <Label>Video URL</Label>
                  <Input
                    value={(content.url as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'url', e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                <div>
                  <Label>Provider</Label>
                  <Select
                    options={[
                      { value: 'youtube', label: 'YouTube' },
                      { value: 'vimeo', label: 'Vimeo' },
                    ]}
                    value={(content.provider as string) || 'youtube'}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'provider', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Aspect Ratio</Label>
                  <Select
                    options={[
                      { value: '16:9', label: '16:9 (Widescreen)' },
                      { value: '4:3', label: '4:3 (Standard)' },
                      { value: '21:9', label: '21:9 (Ultrawide)' },
                    ]}
                    value={(content.aspectRatio as string) || '16:9'}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'aspectRatio', e.target.value)}
                  />
                </div>
              </>
            )}

            {type === 'contact_form' && (
              <>
                <div>
                  <Label>Heading</Label>
                  <Input
                    value={(content.heading as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'heading', e.target.value)}
                    placeholder="Get in Touch"
                  />
                </div>
                <div>
                  <Label>Subtext</Label>
                  <Input
                    value={(content.subtext as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'subtext', e.target.value)}
                    placeholder="We would love to hear from you."
                  />
                </div>
                <div>
                  <Label>Submit Button Text</Label>
                  <Input
                    value={(content.submitText as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'submitText', e.target.value)}
                    placeholder="Send Message"
                  />
                </div>
                <div>
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(content.backgroundColor as string) || '#F8FAFC'}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'backgroundColor', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={(content.backgroundColor as string) || '#F8FAFC'}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'backgroundColor', e.target.value)}
                      placeholder="#F8FAFC"
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'testimonials' && (
              <>
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={(content.heading as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'heading', e.target.value)}
                    placeholder="What Our Customers Say"
                  />
                </div>
                <div>
                  <Label>Testimonials (JSON array)</Label>
                  <Textarea
                    value={JSON.stringify((content.testimonials as Record<string, unknown>[]) || [], null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateSectionContent(selectedSection.id, 'testimonials', parsed);
                      } catch {
                        // invalid JSON, ignore
                      }
                    }}
                    rows={10}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="testimonialAutoplay"
                      checked={content.autoplay !== false}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'autoplay', e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <Label htmlFor="testimonialAutoplay" className="cursor-pointer">Autoplay</Label>
                  </div>
                  <div>
                    <Label>Interval (ms)</Label>
                    <Input
                      type="number"
                      value={String(content.autoplayInterval || 5000)}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'autoplayInterval', parseInt(e.target.value) || 5000)}
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'faq' && (
              <>
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={(content.heading as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'heading', e.target.value)}
                    placeholder="Frequently Asked Questions"
                  />
                </div>
                <div>
                  <Label>FAQ Items (JSON array)</Label>
                  <Textarea
                    value={JSON.stringify((content.items as Record<string, unknown>[]) || [], null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateSectionContent(selectedSection.id, 'items', parsed);
                      } catch {
                        // ignore
                      }
                    }}
                    rows={14}
                    className="font-mono text-xs"
                  />
                </div>
              </>
            )}

            {type === 'features' && (
              <>
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={(content.heading as string) || ''}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'heading', e.target.value)}
                    placeholder="Why Choose Us"
                  />
                </div>
                <div>
                  <Label>Features (JSON array)</Label>
                  <Textarea
                    value={JSON.stringify((content.features as Record<string, unknown>[]) || [], null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateSectionContent(selectedSection.id, 'features', parsed);
                      } catch {
                        // ignore
                      }
                    }}
                    rows={14}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label>Columns</Label>
                  <Select
                    options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
                    value={String(content.columns || 3)}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'columns', parseInt(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Style tab ───────────────────────────────────────────────────────── */}

        {rightTab === 'style' && (
          <div className="space-y-4">
            {type === 'hero_banner' && (
              <>
                <div>
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(content.backgroundColor as string) || '#4F46E5'}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'backgroundColor', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={(content.backgroundColor as string) || '#4F46E5'}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'backgroundColor', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(content.textColor as string) || '#FFFFFF'}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'textColor', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={(content.textColor as string) || '#FFFFFF'}
                      onChange={(e) => updateSectionContent(selectedSection.id, 'textColor', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            {type === 'contact_form' && (
              <div>
                <Label>Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={(content.backgroundColor as string) || '#F8FAFC'}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'backgroundColor', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={(content.backgroundColor as string) || '#F8FAFC'}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'backgroundColor', e.target.value)}
                  />
                </div>
              </div>
            )}
            {(type === 'product_grid' || type === 'features') && (
              <div>
                <Label>Columns</Label>
                <Select
                  options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                  value={String(content.columns || (type === 'product_grid' ? 4 : 3))}
                  onChange={(e) => updateSectionContent(selectedSection.id, 'columns', parseInt(e.target.value))}
                />
              </div>
            )}
            {(type === 'hero_banner' || type === 'rich_text') && (
              <div>
                <Label>Text Alignment</Label>
                <Select
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ]}
                  value={(content.alignment as string) || 'left'}
                  onChange={(e) => updateSectionContent(selectedSection.id, 'alignment', e.target.value)}
                />
              </div>
            )}
            {(type === 'image_gallery') && (
              <>
                <div>
                  <Label>Columns</Label>
                  <Select
                    options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
                    value={String(content.columns || 3)}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'columns', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Gap</Label>
                  <Select
                    options={[
                      { value: 'small', label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large', label: 'Large' },
                    ]}
                    value={(content.gap as string) || 'medium'}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'gap', e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="galleryRadiusStyle"
                    checked={content.borderRadius !== false}
                    onChange={(e) => updateSectionContent(selectedSection.id, 'borderRadius', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <Label htmlFor="galleryRadiusStyle" className="cursor-pointer">Rounded corners</Label>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Settings tab ─────────────────────────────────────────────────────── */}

        {rightTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <Label>Section Visibility</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="sectionActive"
                  checked={selectedSection.isActive}
                  onChange={(e) =>
                    handleUpdateSection(selectedSection.id, { isActive: e.target.checked })
                  }
                  className="rounded border-slate-300 text-indigo-600"
                />
                <Label htmlFor="sectionActive" className="cursor-pointer">
                  Section is visible on published page
                </Label>
              </div>
            </div>
            <div>
              <Label>Section ID</Label>
              <Input value={selectedSection.id} disabled className="text-xs font-mono bg-slate-50" />
            </div>
            <div>
              <Label>Section Type</Label>
              <Input value={type} disabled className="text-xs font-mono bg-slate-50" />
            </div>
            <div>
              <Label>Order</Label>
              <Input
                type="number"
                value={selectedSection.order}
                onChange={(e) =>
                  handleUpdateSection(selectedSection.id, { order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <Separator />
            <div>
              <Label>Raw Content (JSON)</Label>
              <Textarea
                value={JSON.stringify(selectedSection.content || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    updateSectionContent(selectedSection.id, '', parsed);
                    // Actually update content directly
                    setSelectedSection((prev) => prev ? { ...prev, content: parsed } : null);
                    setSections((prev) => prev.map((s) => (s.id === selectedSection.id ? { ...s, content: parsed } : s)));
                    handleUpdateSection(selectedSection.id, { content: parsed });
                  } catch {
                    // ignore invalid JSON
                  }
                }}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            <Separator />
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleDeleteSection(selectedSection.id)}
            >
              Delete Section
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  //  RENDER — Section preview card
  // ══════════════════════════════════════════════════════════════════════════════

  const renderSectionCard = (section: PageSection, index: number) => {
    const isSelected = selectedSectionId === section.id;
    const content = section.content || {};
    const isDragging = draggedIndex === index;
    const isDragOver = dragOverIndex === index;

    let preview: React.ReactNode = null;

    switch (section.type) {
      case 'hero_banner':
        preview = (
          <div
            className="rounded-lg p-6 text-center"
            style={{
              backgroundColor: (content.backgroundColor as string) || '#4F46E5',
              color: (content.textColor as string) || '#FFFFFF',
            }}
          >
            <h3 className="text-lg font-bold">{content.heading as string || 'Hero Banner'}</h3>
            <p className="text-sm opacity-80 mt-1">{content.subtext as string || ''}</p>
          </div>
        );
        break;
      case 'product_grid':
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <span className="text-2xl">📦</span>
            <p className="text-sm text-slate-600 mt-1 font-medium">{content.title as string || 'Product Grid'}</p>
            <p className="text-xs text-slate-400">{content.columns || 4} columns &middot; {content.limit || 8} products</p>
          </div>
        );
        break;
      case 'product_carousel':
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <span className="text-2xl">🎠</span>
            <p className="text-sm text-slate-600 mt-1 font-medium">{content.title as string || 'Product Carousel'}</p>
            <p className="text-xs text-slate-400">Featured products slider</p>
          </div>
        );
        break;
      case 'rich_text':
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-left">
            <h3 className="text-lg font-bold text-slate-900">{content.heading as string || 'Rich Text'}</h3>
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
              {Array.isArray(content.paragraphs) ? (content.paragraphs as string[]).slice(0, 2).join(' ') : ''}
            </p>
          </div>
        );
        break;
      case 'image_gallery':
        const imgs = (content.images as string[]) || [];
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <span className="text-2xl">🖼️</span>
            <p className="text-sm text-slate-600 mt-1 font-medium">Image Gallery</p>
            <p className="text-xs text-slate-400">{imgs.length} images &middot; {content.columns || 3} columns</p>
          </div>
        );
        break;
      case 'video_embed':
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <span className="text-2xl">▶️</span>
            <p className="text-sm text-slate-600 mt-1 font-medium">Video Embed</p>
            <p className="text-xs text-slate-400">{(content.provider as string) || 'YouTube'} &middot; {(content.aspectRatio as string) || '16:9'}</p>
          </div>
        );
        break;
      case 'contact_form':
        preview = (
          <div
            className="rounded-lg p-4 text-center"
            style={{ backgroundColor: (content.backgroundColor as string) || '#F8FAFC' }}
          >
            <span className="text-2xl">✉️</span>
            <p className="text-sm text-slate-700 mt-1 font-medium">{content.heading as string || 'Contact Form'}</p>
          </div>
        );
        break;
      case 'testimonials':
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <span className="text-2xl">💬</span>
            <p className="text-sm text-slate-600 mt-1 font-medium">{content.heading as string || 'Testimonials'}</p>
            <p className="text-xs text-slate-400">{Array.isArray(content.testimonials) ? (content.testimonials as unknown[]).length : 0} reviews</p>
          </div>
        );
        break;
      case 'faq':
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <span className="text-2xl">❓</span>
            <p className="text-sm text-slate-600 mt-1 font-medium">{content.heading as string || 'FAQ'}</p>
            <p className="text-xs text-slate-400">{Array.isArray(content.items) ? (content.items as unknown[]).length : 0} questions</p>
          </div>
        );
        break;
      case 'features':
        preview = (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <span className="text-2xl">⚡</span>
            <p className="text-sm text-slate-600 mt-1 font-medium">{content.heading as string || 'Features'}</p>
            <p className="text-xs text-slate-400">{Array.isArray(content.features) ? (content.features as unknown[]).length : 0} features &middot; {content.columns || 3} columns</p>
          </div>
        );
        break;
    }

    return (
      <div
        draggable
        onDragStart={() => handleDragStart(index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        onClick={() => {
          setSelectedSectionId(section.id);
          setSelectedSection(section);
        }}
        className={[
          'group relative rounded-xl border-2 cursor-pointer transition-all',
          isSelected
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30'
            : 'border-slate-200 bg-white hover:border-slate-300',
          isDragging ? 'opacity-50 scale-[0.98]' : '',
          isDragOver ? 'border-indigo-300 bg-indigo-50/20' : '',
        ].join(' ')}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="cursor-grab text-slate-400 hover:text-slate-600 select-none">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                </svg>
              </span>
              <span className="text-sm">{getSectionTypeIcon(type)}</span>
              <span className="text-sm font-medium text-slate-700">{getSectionTypeLabel(type)}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); handleDuplicateSection(section); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                title="Duplicate"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 3a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3.93a2 2 0 0 0-1.66.9L6.06 17H5a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h2zm0 2H5v9h1.06l5.66-5.66a1 1 0 0 1 1.66.9V16h2V5H7v.01zm9-1v9h1v-2.5a2.5 2.5 0 0 1 2.5-2.5h.5v-2h-.5a.5.5 0 0 0-.5.5V4z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                title="Delete"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-3">{preview}</div>
          {!section.isActive && (
            <div className="mt-2">
              <Badge variant="neutral">Hidden</Badge>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: sidebarLinks,
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Store Builder',
        subtitle: `Storefront: ${STOREFRONT_ID}`,
        actions: (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={!selectedPageId || !pageIsPublished}>
              Preview
            </Button>
            <Button onClick={handleTogglePublish} disabled={!selectedPageId || saving}>
              {pageIsPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        ),
      }}
    >
      <div className="flex h-[calc(100vh-120px)] gap-0">
        {/* ─── LEFT SIDEBAR — Pages ────────────────────────────────────────────── */}

        <div className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <Heading as="h3" className="text-sm font-semibold text-slate-800">Pages</Heading>
              <Button size="sm" variant="default" onClick={openCreatePage} className="h-7 text-xs">
                + New
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {pages.length === 0 && !loading && (
              <div className="text-center py-8">
                <Text variant="muted" className="text-xs">No pages yet. Create your first page.</Text>
              </div>
            )}
            {pages.map((page) => (
              <div
                key={page.id}
                onClick={() => selectPage(page)}
                className={[
                  'group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors',
                  selectedPageId === page.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <span className="text-sm flex-1 truncate font-medium">{page.title}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {page.isPublished && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                      Live
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditPage(page); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-indigo-600"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-600"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          {loading && (
            <div className="p-3">
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 rounded-lg bg-slate-100" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── CENTER — Canvas ─────────────────────────────────────────────────── */}

        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Page header bar */}
          {selectedPageId && (
            <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    onBlur={handleSavePageMeta}
                    className="h-8 text-sm font-medium border-0 px-0 focus:ring-0"
                    placeholder="Page title"
                  />
                  <Input
                    value={pageSlug}
                    onChange={(e) => setPageSlug(e.target.value)}
                    onBlur={handleSavePageMeta}
                    className="h-7 text-xs text-slate-500 border-0 px-0 focus:ring-0 mt-0.5"
                    placeholder="page-slug"
                  />
                </div>
                <Badge variant={pageIsPublished ? 'success' : 'neutral'}>
                  {pageIsPublished ? 'Published' : 'Draft'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSectionPickerOpen(true)}
                >
                  + Add Section
                </Button>
              </div>
            </div>
          )}

          {/* Section list */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedPageId ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-5xl mb-4">📄</div>
                <Heading as="h3" className="text-lg font-semibold text-slate-900">Select a page to edit</Heading>
                <Text variant="muted" className="mt-2 max-w-sm">
                  Choose a page from the sidebar or create a new one to start building your storefront.
                </Text>
              </div>
            ) : sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-5xl mb-4">🎨</div>
                <Heading as="h3" className="text-lg font-semibold text-slate-900">No sections yet</Heading>
                <Text variant="muted" className="mt-2 max-w-sm">
                  Add sections to build your page. Choose from banners, product grids, forms, and more.
                </Text>
                <Button className="mt-4" onClick={() => setSectionPickerOpen(true)}>
                  + Add First Section
                </Button>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-3">
                {sections.map((section, index) => renderSectionCard(section, index))}
                {/* Add section button at bottom */}
                <button
                  onClick={() => setSectionPickerOpen(true)}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                >
                  <span className="text-lg">+</span> Add Section
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT PANEL — Properties ───────────────────────────────────────── */}

        <div className="w-80 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          {!selectedSection ? (
            <div className="p-6 text-center">
              <div className="text-4xl mb-3">⚙️</div>
              <Text variant="muted" className="text-sm">
                Select a section to edit its properties
              </Text>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Heading as="h4" className="text-sm font-semibold text-slate-900">Section Properties</Heading>
                <Badge variant="info" className="text-xs">
                  {getSectionTypeLabel(selectedSection.type)}
                </Badge>
              </div>
              {renderSectionEditor()}
            </div>
          )}
        </div>
      </div>

      {/* ─── Section Picker Modal ──────────────────────────────────────────────── */}

      {sectionPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <Heading as="h3" className="text-lg font-semibold">Add Section</Heading>
              <button
                onClick={() => setSectionPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3">
                {SECTION_TYPES.map((section) => (
                  <button
                    key={section.value}
                    onClick={() => handleAddSection(section.value)}
                    className="flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                  >
                    <span className="text-2xl">{section.icon}</span>
                    <span className="text-sm font-medium text-slate-900">{section.label}</span>
                    <span className="text-xs text-slate-500">{section.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Page Create/Edit Modal ───────────────────────────────────────────── */}

      {pageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <Heading as="h3" className="text-lg font-semibold">
                  {editingPageTitle ? 'Edit Page' : 'Create New Page'}
                </Heading>
                <button onClick={() => setPageModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <Label>Page Title *</Label>
                  <Input
                    value={editingPageTitle}
                    onChange={(e) => setEditingPageTitle(e.target.value)}
                    placeholder="Home, About Us, Contact..."
                  />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input
                    value={editingPageSlug}
                    onChange={(e) => setEditingPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="home, about-us, contact"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setPageModalOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleCreatePage} disabled={saving}>
                  {saving ? 'Creating…' : 'Create Page'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Toast ────────────────────────────────────────────────────────────── */}

      {toast && (
        <div
          className={[
            'fixed top-6 right-6 z-[60] rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all',
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
          ].join(' ')}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </DashboardShell>
  );
}

// ─── Inline Separator (re-exported from UI package as needed) ───────────────────

function Separator({ className }: { className?: string }) {
  return <div className={['my-4 h-px bg-slate-200', className].join(' ')} />;
}
