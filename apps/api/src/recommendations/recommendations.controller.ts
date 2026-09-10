/**
 * ZYRA — Recommendations Controller (Phase 3.3)
 * Routes: /recommendations/*
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  RecommendationsService,
  type UpsellInput,
  type CrossSellInput,
  type TrendingInput,
} from './recommendations.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  // ── Upsell ──────────────────────────────────────────────────────────

  @Get('upsell/:productId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('products', 'read')
  getUpsell(@Param('productId') productId: string, @Query('customerId') customerId?: string, @Query('limit') limit?: string) {
    if (!productId) throw new BadRequestException('productId is required.');
    return this.recommendationsService.getUpsellSuggestions({
      productId,
      customerId,
      limit: limit ? +limit : 5,
    });
  }

  // ── Cross-sell ─────────────────────────────────────────────────────

  @Get('cross-sell')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('products', 'read')
  getCrossSell(
    @Query('productIds') productIds: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!productIds) throw new BadRequestException('productIds (comma-separated) is required.');
    const cartItemProductIds = productIds.split(',').map((id) => id.trim()).filter(Boolean);
    return this.recommendationsService.getCrossSellSuggestions({
      cartItemProductIds,
      customerId,
      limit: limit ? +limit : 6,
    });
  }

  // ── Personalised ───────────────────────────────────────────────────

  @Get('personalized/:customerId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('customers', 'read')
  getPersonalized(@Param('customerId') customerId: string, @Query('limit') limit?: string) {
    return this.recommendationsService.getPersonalizedRecommendations(customerId, limit ? +limit : 8);
  }

  // ── Trending ───────────────────────────────────────────────────────

  @Get('trending')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('products', 'read')
  getTrending(@Query('tenantId') tenantId: string, @Query('limit') limit?: string, @Query('daysBack') daysBack?: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required.');
    return this.recommendationsService.getTrendingProducts({
      tenantId,
      limit: limit ? +limit : 10,
      daysBack: daysBack ? +daysBack : undefined,
    });
  }

  // ── For Lead ───────────────────────────────────────────────────────

  @Get('for-lead/:leadId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('leads', 'read')
  getForLead(@Param('leadId') leadId: string) {
    return this.recommendationsService.getForLead(leadId);
  }
}
