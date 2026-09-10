/**
 * ZYRA — Recommendations Service (Phase 3.3)
 *
 * Rule-based recommendation engine: upsells, cross-sells,
 * personalised picks, and trending products.
 *
 * NO AI — all logic is deterministic Prisma queries + scoring rules.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductRecommendation {
  productId: string;
  name: string;
  price: number;
  images: string[];
  reason: string;
  score: number;
}

export interface UpsellInput {
  productId: string;
  customerId?: string;
  limit?: number;
}

export interface CrossSellInput {
  cartItemProductIds: string[];
  customerId?: string;
  limit?: number;
}

export interface TrendingInput {
  tenantId: string;
  limit?: number;
  daysBack?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly TRENDING_WINDOW_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Upsell ─────────────────────────────────────────────────────────

  /**
   * Return products that are better / more-expensive alternatives
   * within the same category, ranked by price proximity and tag overlap.
   */
  async getUpsellSuggestions(input: UpsellInput): Promise<ProductRecommendation[]> {
    const { productId, customerId, limit = 5 } = input;

    const baseProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, images: true, category: true, tags: true, storefrontId: true, tenantId: true },
    });

    if (!baseProduct) return [];

    const candidates = await this.prisma.product.findMany({
      where: {
        id: { not: productId },
        isActive: true,
        storefrontId: baseProduct.storefrontId,
        OR: [
          { category: { not: null, equals: baseProduct.category ?? undefined } },
          { tags: { hasSome: baseProduct.tags ?? [] } },
        ],
      },
      select: { id: true, name: true, price: true, images: true, category: true, tags: true },
      take: 50,
    });

    const scored = candidates
      .map((p) => ({
        productId: p.id,
        name: p.name,
        price: Number(p.price),
        images: p.images,
        score: this._scoreUpsell(
        { price: Number(baseProduct.price), category: baseProduct.category, tags: baseProduct.tags },
        { price: Number(p.price), category: p.category, tags: p.tags },
      ),
        reason: this._upsellReason(
          { category: baseProduct.category },
          { price: Number(p.price), category: p.category },
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    this.eventBus.emit('recommendations.upsell', { productId, customerId, count: scored.length });
    return scored;
  }

  // ── Cross-sell ─────────────────────────────────────────────────────

  /**
   * Return products that complement the items already in the cart.
   * Strategy: same category but different product OR same tag co-occurrence
   * from historical orders.
   */
  async getCrossSellSuggestions(input: CrossSellInput): Promise<ProductRecommendation[]> {
    const { cartItemProductIds, customerId, limit = 6 } = input;

    if (!cartItemProductIds.length) return [];

    const cartProducts = await this.prisma.product.findMany({
      where: { id: { in: cartItemProductIds } },
      select: { id: true, category: true, tags: true, storefrontId: true },
    });

    const storefrontId = cartProducts[0]?.storefrontId;
    const allTags = cartProducts.flatMap((p) => p.tags ?? []);
    const categories = [...new Set(cartProducts.map((p) => p.category).filter((c): c is string => c !== null))];

    const alreadyInCart = new Set(cartItemProductIds);

    // ── Strategy 1: find frequently co-purchased products ────────────
    const coPurchased = await this._findCoPurchased(cartItemProductIds, storefrontId, alreadyInCart, 20);

    // ── Strategy 2: same-category / shared-tag fillers ───────────────
    const whereClause: Record<string, unknown> = {
      isActive: true,
      storefrontId,
      id: { notIn: cartItemProductIds },
    };
    if (categories.length) whereClause.category = { in: categories };
    if (allTags.length) whereClause.tags = { hasSome: allTags };

    const sameCategory = await this.prisma.product.findMany({
      where: whereClause,
      select: { id: true, name: true, price: true, images: true, category: true, tags: true },
      take: 30,
    });

    const combined = [...coPurchased, ...sameCategory];
    const seen = new Set<string>();
    const unique: typeof combined = [];
    for (const item of combined) {
      if (!seen.has(item.id)) { seen.add(item.id); unique.push(item); }
    }

    const scored = unique
      .map((p) => ({
        productId: p.id,
        name: p.name,
        price: Number(p.price),
        images: p.images,
        score: this._scoreCrossSell(cartProducts as Array<{ category: string | null; tags: string[] }>, { category: p.category, tags: p.tags }),
        reason: this._crossSellReason(cartProducts, { category: p.category }),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    this.eventBus.emit('recommendations.crossSell', { cartItemProductIds, customerId, count: scored.length });
    return scored;
  }

  // ── Personalised ───────────────────────────────────────────────────

  /**
   * Rule-based personalised recommendations:
   * 1. Purchase history → similar products to what they bought
   * 2. Wishlist items → similar products
   * 3. Cart items → recommendations (delegates to cross-sell)
   * 4. Fallback → trending
   */
  async getPersonalizedRecommendations(customerId: string, limit = 8): Promise<ProductRecommendation[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, tenantId: true, tags: true },
    });

    if (!customer) return [];

    // ── Past purchased product IDs ────────────────────────────────────
    const pastOrders = await this.prisma.order.findMany({
      where: { customerId, status: { not: 'CANCELLED' } },
      include: { items: { select: { productId: true } } },
      take: 20,
    });
    const purchasedIds = [...new Set(pastOrders.flatMap((o) => o.items.map((i) => i.productId)))];

    // ── Wishlist product IDs ──────────────────────────────────────────
    const wishlistItems = await this.prisma.wishlistItem.findMany({
      where: { customerId },
      select: { productId: true },
    });
    const wishlistIds = wishlistItems.map((w) => w.productId);

    // ── Active cart product IDs ───────────────────────────────────────
    const activeCart = await this.prisma.cart.findFirst({
      where: { customerId },
      include: { items: { select: { productId: true } } },
    });
    const cartIds = activeCart?.items.map((i) => i.productId) ?? [];

    const excludeIds = new Set([...purchasedIds, ...wishlistIds, ...cartIds]);

    // ── Fetch candidate products from tenant ──────────────────────────
    const candidates = await this.prisma.product.findMany({
      where: {
        isActive: true,
        tenantId: customer.tenantId,
        ...(excludeIds.size ? { id: { notIn: [...excludeIds] } } : {}),
      },
      select: { id: true, name: true, price: true, images: true, category: true, tags: true },
      take: 80,
    });

    // Score each candidate
    const pastProducts = await this.prisma.product.findMany({
      where: { id: { in: purchasedIds } },
      select: { id: true, category: true, tags: true },
    });

    const wishlistProducts = await this.prisma.product.findMany({
      where: { id: { in: wishlistIds } },
      select: { id: true, category: true, tags: true },
    });

    const scored = candidates
      .map((p) => {
        const similarityToPast = pastProducts.reduce((max, pp) => Math.max(max, this._calculateSimilarity(pp, p)), 0);
        const similarityToWishlist = wishlistProducts.reduce((max, wp) => Math.max(max, this._calculateSimilarity(wp, p)), 0);
        const tagBoost = this._tagBoost(p.tags ?? [], customer.tags ?? []);
        const score = Math.round(similarityToPast * 100 + similarityToWishlist * 120 + tagBoost);
        const reason = this._personalisedReason(score, similarityToPast, similarityToWishlist, tagBoost);
        return { productId: p.id, name: p.name, price: Number(p.price), images: p.images, score, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    this.eventBus.emit('recommendations.personalized', { customerId, count: scored.length });
    return scored;
  }

  // ── Trending ──────────────────────────────────────────────────────

  /**
   * Top-selling products in the last N days, ranked by quantity sold.
   */
  async getTrendingProducts(input: TrendingInput): Promise<ProductRecommendation[]> {
    const { tenantId, limit = 10, daysBack = this.TRENDING_WINDOW_DAYS } = input;

    const since = new Date(Date.now() - daysBack * 24 * 60 * 60_000);

    const topProductIds = await this.prisma.orderItem.findMany({
      where: {
        order: {
          tenantId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: since },
        },
      },
      select: { productId: true, quantity: true },
    });

    // Aggregate quantities
    const salesMap = new Map<string, number>();
    for (const item of topProductIds) {
      salesMap.set(item.productId, (salesMap.get(item.productId) || 0) + item.quantity);
    }

    const sorted = [...salesMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit * 2); // fetch a few extra to filter inactive

    if (!sorted.length) return [];

    const productIds = sorted.map(([id]) => id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, name: true, price: true, images: true, category: true, tags: true },
    });

    const maxQty = sorted[0]?.[1] ?? 1;
    const productMap = new Map(products.map((p) => [p.id, p]));

    const result: ProductRecommendation[] = [];
    for (const [pid, qty] of sorted) {
      const p = productMap.get(pid);
      if (!p) continue;
      const score = Math.round((qty / maxQty) * 100);
      result.push({
        productId: p.id,
        name: p.name,
        price: Number(p.price),
        images: p.images,
        reason: `Trending · ${qty} sold recently`,
        score,
      });
      if (result.length >= limit) break;
    }

    this.eventBus.emit('recommendations.trending', { tenantId, limit, count: result.length });
    return result;
  }

  /**
   * Recommendations tailored to a lead's attributes.
   */
  async getForLead(leadId: string): Promise<ProductRecommendation[]> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, tenantId: true, source: true, score: true, metadata: true },
    });

    if (!lead) return [];

    // Use tenant-level trending as a proxy for lead interests
    return this.getTrendingProducts({ tenantId: lead.tenantId, limit: 5 });
  }

  // ── Private: Similarity ────────────────────────────────────────────

  /**
   * Jaccard-style similarity (0-1) between two products.
   * Considers: category match, tag overlap, price proximity.
   */
  private _calculateSimilarity(productA: { category: string | null; tags: string[] }, productB: { category: string | null; tags: string[] }): number {
    let score = 0;

    // Category match — strongest signal
    if (productA.category && productA.category === productB.category) {
      score += 0.5;
    }

    // Tag overlap — Jaccard
    const tagsA = new Set(productA.tags ?? []);
    const tagsB = new Set(productB.tags ?? []);
    const intersection = [...tagsA].filter((t) => tagsB.has(t)).length;
    const union = new Set([...tagsA, ...tagsB]).size;
    if (union > 0) {
      score += (intersection / union) * 0.5;
    }

    return Math.min(score, 1);
  }

  // ── Private: Co-purchase helper ────────────────────────────────────

  private async _findCoPurchased(
    productIds: string[],
    _storefrontId: string | undefined,
    excludeIds: Set<string>,
    _take: number,
  ): Promise<Array<{ id: string; name: string; price: number; images: string[]; category: string | null; tags: string[] }>> {
    const orders = await this.prisma.order.findMany({
      where: {
        items: { some: { productId: { in: productIds } } },
        status: { not: 'CANCELLED' },
      },
      include: { items: { where: { productId: { notIn: [...excludeIds] } }, select: { productId: true } } },
      take: 20,
    });

    const coProductIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
    if (!coProductIds.length) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: coProductIds.slice(0, 30) }, isActive: true },
      select: { id: true, name: true, price: true, images: true, category: true, tags: true },
      take: _take,
    });

    return products.map((p) => ({ ...p, price: Number(p.price) }));
  }

  // ── Private: Scoring helpers ───────────────────────────────────────

  private _scoreUpsell(base: Record<string, unknown>, candidate: Record<string, unknown>): number {
    let score = 0;
    if (Number(candidate.price) > Number(base.price)) {
      score += 30;
      score += Math.min(Number(candidate.price) - Number(base.price), 200);
    }
    if (base.category && base.category === candidate.category) score += 25;
    const baseTags = (base.tags as string[]) ?? [];
    const candTags = (candidate.tags as string[]) ?? [];
    const commonTags = baseTags.filter((t) => candTags.includes(t));
    score += commonTags.length * 10;
    return score;
  }

  private _scoreCrossSell(cartProducts: Array<Record<string, unknown>>, candidate: Record<string, unknown>): number {
    let score = 0;
    for (const cp of cartProducts) {
      if (candidate.category && candidate.category === cp.category) score += 15;
      const cpTags = (cp.tags as string[]) ?? [];
      const candTags = (candidate.tags as string[]) ?? [];
      const commonTags = cpTags.filter((t) => candTags.includes(t));
      score += commonTags.length * 8;
    }
    return score;
  }

  private _tagBoost(productTags: string[], customerTags: string[]): number {
    if (!customerTags.length || !productTags.length) return 0;
    const matches = productTags.filter((t) => customerTags.includes(t)).length;
    return matches * 20;
  }

  private _upsellReason(base: Record<string, unknown>, candidate: { price: number; category: string | null }): string {
    if (Number(candidate.price) > 0 && base.category && base.category === candidate.category) {
      return `Premium alternative in ${candidate.category}`;
    }
    if (Number(candidate.price) > 0) {
      return 'Higher-value option';
    }
    return 'Similar alternative';
  }

  private _crossSellReason(cartProducts: Array<Record<string, unknown>>, candidate: Record<string, unknown>): string {
    for (const cp of cartProducts) {
      if (candidate.category && cp.category && candidate.category === cp.category) {
        return `Frequently bought with items in ${candidate.category}`;
      }
    }
    return 'Customers also buy';
  }

  private _personalisedReason(_score: number, pastSim: number, wishlistSim: number, tagBoost: number): string {
    if (pastSim > 0.5) return 'Based on your purchase history';
    if (wishlistSim > 0.5) return 'Similar to your wishlist';
    if (tagBoost > 0) return 'Matches your interests';
    return 'Recommended for you';
  }
}
