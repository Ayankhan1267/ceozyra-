/**
 * ZYRA — Google Ads Integration Controller
 *
 * Endpoints:
 *   POST   /integrations/google/connect   — OAuth connect
 *   POST   /integrations/google/sync      — Sync campaigns from Google Ads
 *   GET    /integrations/google/campaigns — List campaigns
 *   GET    /integrations/google/campaigns/:id/metrics — Campaign metrics
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { RequirePermission } from '../../rbac/permissions.decorator';
import { GoogleService } from './google.service';

interface AuthRequest {
  user: { sub: string; tenantId: string };
  tenant: { id: string };
}

@Controller('integrations/google')
@UseGuards(AuthGuard)
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Post('connect')
  @RequirePermission('integrations', 'write')
  async connect(@Req() req: AuthRequest, @Body() body: { code: string; redirectUri: string }) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    return this.googleService.connectOAuth(tenantId, body.code, body.redirectUri);
  }

  @Post('sync')
  @RequirePermission('integrations', 'write')
  async sync(@Req() req: AuthRequest) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    return this.googleService.syncCampaigns(tenantId);
  }

  @Get('campaigns')
  @RequirePermission('campaigns', 'read')
  async getCampaigns(
    @Req() req: AuthRequest,
    @Query('customerId') customerId: string,
  ) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    if (!customerId) throw new BadRequestException('customerId query param required');
    return this.googleService.getCampaignMetrics(tenantId, customerId, '');
  }

  @Get('campaigns/:id/metrics')
  @RequirePermission('campaigns', 'read')
  async getMetrics(
    @Req() req: AuthRequest,
    @Param('id') campaignResourceName: string,
    @Query('customerId') customerId: string,
  ) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    if (!customerId) throw new BadRequestException('customerId query param required');
    return this.googleService.getCampaignMetrics(tenantId, customerId, campaignResourceName);
  }
}
