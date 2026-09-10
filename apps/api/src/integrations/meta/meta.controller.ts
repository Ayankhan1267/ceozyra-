/**
 * ZYRA — Meta (Facebook/Instagram) Integration Controller
 *
 * Endpoints:
 *   POST   /integrations/meta/connect     — OAuth connect
 *   POST   /integrations/meta/sync        — Sync campaigns from Meta
 *   GET    /integrations/meta/campaigns   — List connected ad accounts
 *   GET    /integrations/meta/campaigns/:id/insights — Campaign insights
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { RequirePermission } from '../../rbac/permissions.decorator';
import { MetaService } from './meta.service';

interface AuthRequest {
  user: { sub: string; tenantId: string };
  tenant: { id: string };
}

@Controller('integrations/meta')
@UseGuards(AuthGuard)
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Post('connect')
  @RequirePermission('integrations', 'write')
  async connect(@Req() req: AuthRequest, @Body() body: { code: string; redirectUri: string }) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    return this.metaService.connectOAuth(tenantId, body.code, body.redirectUri);
  }

  @Post('sync')
  @RequirePermission('integrations', 'write')
  async sync(@Req() req: AuthRequest) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    return this.metaService.syncCampaigns(tenantId);
  }

  @Get('campaigns')
  @RequirePermission('campaigns', 'read')
  async getAdAccounts(@Req() req: AuthRequest) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    return this.metaService.getAdAccounts(tenantId);
  }

  @Get('campaigns/:id/insights')
  @RequirePermission('campaigns', 'read')
  async getInsights(
    @Req() req: AuthRequest,
    @Param('id') campaignId: string,
    @Query('datePreset') datePreset = 'last_30d',
  ) {
    const tenantId = req.tenant?.id ?? req.user.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    return this.metaService.getCampaignInsights(tenantId, campaignId, datePreset);
  }
}
