/**
 * ZYRA — Meta (Facebook/Instagram) Integration Service
 *
 * Handles OAuth connection, campaign/ad-set/ad creation, and insights sync
 * via Meta Marketing API v18+ (Graph API).
 *
 * Env vars required:
 *   META_APP_ID, META_APP_SECRET
 *
 * OAuth scopes requested:
 *   ads_management, read_insights, business_management
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

const META_GRAPH_VERSION = 'v18.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface MetaOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  targeting?: Record<string, unknown>;
  billing_event?: string;
  optimization_goal?: string;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative: { creative_id: string };
}

interface MetaInsightField {
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  spend: string;
  cpc: string;
  cpm: string;
  ctr: string;
  reach: string;
  frequency: string;
  actions?: Array<{ action_type: string; value: string }>;
}

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {
    this.appId = process.env.META_APP_ID || '';
    this.appSecret = process.env.META_APP_SECRET || '';

    if (!this.appId || !this.appSecret) {
      this.logger.warn('META_APP_ID or META_APP_SECRET not set — MetaService will operate in stub mode.');
    }
  }

  // ── OAuth ─────────────────────────────────────────────────────────────────

  /**
   * Exchange authorization code for long-lived access token (60 days).
   * Stores OAuthConnection + Integration record in the database.
   */
  async connectOAuth(tenantId: string, code: string, redirectUri: string) {
    if (!this.appId || !this.appSecret) {
      throw new BadRequestException('Meta OAuth credentials not configured');
    }

    try {
      // Step 1: Exchange code for short-lived token
      const tokenUrl = `${META_GRAPH_BASE}/oauth/access_token`;
      const params = new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: redirectUri,
        code,
      });

      const shortLivedRes = await fetch(`${tokenUrl}?${params}`, { method: 'GET' });
      if (!shortLivedRes.ok) {
        const error = await shortLivedRes.text();
        throw new BadRequestException(`Meta token exchange failed: ${error}`);
      }
      const shortToken = (await shortLivedRes.json()) as MetaOAuthTokenResponse;

      // Step 2: Exchange for long-lived token (60 days)
      const longLivedRes = await fetch(
        `${META_GRAPH_BASE}/oauth/access_token?` +
          new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortToken.access_token,
          }),
        { method: 'GET' },
      );
      if (!longLivedRes.ok) {
        const error = await longLivedRes.text();
        throw new BadRequestException(`Meta long-lived token failed: ${error}`);
      }
      const longToken = (await longLivedRes.json()) as MetaOAuthTokenResponse;

      // Step 3: Get user/ad account info
      const meRes = await fetch(
        `${META_GRAPH_BASE}/me?` + new URLSearchParams({ access_token: longToken.access_token, fields: 'id,name' }),
        { method: 'GET' },
      );
      const meData = (await meRes.json()) as { id: string; name: string };

      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      // Create/update Integration record
      const integration = await this.prisma.integration.upsert({
        where: { tenantId_provider: { tenantId, provider: 'meta' } },
        update: { status: 'CONNECTED', isEnabled: true, name: `Meta Ads (${meData.name})`, config: { metaUserId: meData.id } },
        create: { tenantId, provider: 'meta', name: `Meta Ads (${meData.name})`, status: 'CONNECTED', isEnabled: true, config: { metaUserId: meData.id } },
      });

      // Create/update OAuthConnection record
      await this.prisma.oAuthConnection.upsert({
        where: { id: `${tenantId}-meta` },
        update: {
          provider: 'meta',
          status: 'CONNECTED',
          scope: 'ads_management,read_insights,business_management',
          accessTokenEncrypted: longToken.access_token,
          tokenExpiresAt: expiresAt,
          externalAccountId: meData.id,
        },
        create: {
          id: `${tenantId}-meta`,
          tenantId,
          integrationId: integration.id,
          provider: 'meta',
          status: 'CONNECTED',
          scope: 'ads_management,read_insights,business_management',
          accessTokenEncrypted: longToken.access_token,
          tokenExpiresAt: expiresAt,
          externalAccountId: meData.id,
        },
      });

      this.eventBus.emit('integration.connected', { tenantId, provider: 'meta', integrationId: integration.id });
      return { integration, connected: true };
    } catch (error: any) {
      this.logger.error(`Meta OAuth connect failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Meta OAuth failed: ${error.message}`);
    }
  }

  // ── Ad Accounts ───────────────────────────────────────────────────────────

  async getAdAccounts(tenantId: string) {
    const connection = await this.getValidConnection(tenantId);
    const res = await fetch(
      `${META_GRAPH_BASE}/me/adaccounts?` +
        new URLSearchParams({
          access_token: connection.accessTokenEncrypted,
          fields: 'id,name,account_status,currency,timezone_name',
          limit: '50',
        }),
      { method: 'GET' },
    );
    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Meta getAdAccounts failed: ${error}`);
    }
    const data = (await res.json()) as { data: MetaAdAccount[] };
    return data.data;
  }

  // ── Campaign / AdSet / Ad Creation ────────────────────────────────────────

  /**
   * Create a campaign in Meta Ads Manager.
   * Maps ZYRA Campaign config to Meta campaign fields.
   */
  async createCampaign(
    tenantId: string,
    adAccountId: string,
    zyraCampaignId: string,
    name: string,
    objective: string,
    budgetCents: number,
    status: string = 'PAUSED',
  ) {
    const connection = await this.getValidConnection(tenantId);
    const dailyBudgetMicros = Math.round((budgetCents / 100) * 100 * 1_000_000); // USD cents → micros

    const payload = {
      name,
      objective: this.mapObjective(objective),
      status: status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
      daily_budget: String(dailyBudgetMicros),
      adaccount_id: adAccountId,
      special_ad_categories: JSON.stringify([]),
    };

    const res = await fetch(
      `${META_GRAPH_BASE}/act_${adAccountId}/campaigns?` +
        new URLSearchParams({ access_token: connection.accessTokenEncrypted }),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Meta createCampaign failed: ${error}`);
    }

    const campaign = (await res.json()) as MetaCampaign;
    this.logger.log(`Meta campaign created: ${campaign.id} (ZYRA: ${zyraCampaignId})`);

    // Update ZYRA Ad record with externalId if it exists
    await this.prisma.ad.updateMany({
      where: { id: zyraCampaignId, tenantId },
      data: { externalId: campaign.id },
    });

    return campaign;
  }

  async createAdSet(
    tenantId: string,
    adAccountId: string,
    campaignId: string,
    name: string,
    targeting: Record<string, unknown>,
    dailyBudgetCents: number,
  ) {
    const connection = await this.getValidConnection(tenantId);
    const dailyBudgetMicros = Math.round((dailyBudgetCents / 100) * 100 * 1_000_000);

    const payload: Record<string, unknown> = {
      name,
      campaign_id: campaignId,
      status: 'PAUSED',
      daily_budget: String(dailyBudgetMicros),
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      targeting: JSON.stringify({
        ...targeting,
        geo_locations: { countries: ['US'] },
      }),
      promoted_object: JSON.stringify({ page_id: '' }),
    };

    const res = await fetch(
      `${META_GRAPH_BASE}/act_${adAccountId}/adsets?` +
        new URLSearchParams({ access_token: connection.accessTokenEncrypted }),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Meta createAdSet failed: ${error}`);
    }
    return (await res.json()) as MetaAdSet;
  }

  async createAd(
    tenantId: string,
    adAccountId: string,
    adSetId: string,
    name: string,
    creativeMetaId: string,
    zyraAdId: string,
  ) {
    const connection = await this.getValidConnection(tenantId);

    const payload = {
      name,
      adset_id: adSetId,
      status: 'PAUSED',
      creative: { creative_id: creativeMetaId },
    };

    const res = await fetch(
      `${META_GRAPH_BASE}/act_${adAccountId}/ads?` +
        new URLSearchParams({ access_token: connection.accessTokenEncrypted }),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Meta createAd failed: ${error}`);
    }

    const ad = (await res.json()) as MetaAd;
    await this.prisma.ad.updateMany({ where: { id: zyraAdId, tenantId }, data: { externalId: ad.id } });
    return ad;
  }

  // ── Insights ──────────────────────────────────────────────────────────────

  /**
   * Fetch campaign-level insights from Meta.
   * Returns aggregated metrics: impressions, clicks, spend, cpc, cpm, ctr, etc.
   */
  async getCampaignInsights(tenantId: string, externalCampaignId: string, datePreset = 'last_30d') {
    const connection = await this.getValidConnection(tenantId);

    const fields = [
      'campaign_id',
      'campaign_name',
      'date_start',
      'date_stop',
      'impressions',
      'clicks',
      'spend',
      'cpc',
      'cpm',
      'ctr',
      'reach',
      'frequency',
      'actions',
    ].join(',');

    const res = await fetch(
      `${META_GRAPH_BASE}/${externalCampaignId}/insights?` +
        new URLSearchParams({
          access_token: connection.accessTokenEncrypted,
          fields,
          date_preset: datePreset,
          time_increment: '1',
          limit: '100',
        }),
      { method: 'GET' },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Meta getCampaignInsights failed: ${error}`);
    }

    const data = (await res.json()) as { data: MetaInsightField[] };
    return data.data.map((row) => ({
      dateStart: row.date_start,
      dateStop: row.date_stop,
      impressions: Number(row.impressions),
      clicks: Number(row.clicks),
      spend: Number(row.spend),
      cpc: Number(row.cpc),
      cpm: Number(row.cpm),
      ctr: Number(row.ctr),
      reach: Number(row.reach),
      frequency: Number(row.frequency),
      conversions: this.extractActions(row.actions),
    }));
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  /**
   * Sync all Meta campaigns for a tenant.
   * Queries the Meta API and upserts records into ZYRA.
   */
  async syncCampaigns(tenantId: string) {
    const connection = await this.getValidConnection(tenantId);
    const integration = await this.getIntegration(tenantId);
    if (!integration.isEnabled) throw new BadRequestException('Meta integration is disabled');

    const adAccounts = await this.getAdAccounts(tenantId);
    const synced: { externalId: string; name: string; status: string }[] = [];

    for (const account of adAccounts) {
      const campaignRes = await fetch(
        `${META_GRAPH_BASE}/act_${account.id}/campaigns?` +
          new URLSearchParams({
            access_token: connection.accessTokenEncrypted,
            fields: 'id,name,status,objective,start_time,end_time',
            limit: '100',
          }),
        { method: 'GET' },
      );

      if (!campaignRes.ok) continue;
      const { data: metaCampaigns } = (await campaignRes.json()) as { data: MetaCampaign[] };

      for (const mc of metaCampaigns) {
        await this.prisma.campaign.upsert({
          where: { id: mc.id },
          update: {
            name: mc.name,
            status: this.mapMetaStatus(mc.status),
            objective: mc.objective,
            startAt: mc.start_time ? new Date(mc.start_time) : undefined,
            endAt: mc.end_time ? new Date(mc.end_time) : undefined,
            config: { source: 'meta', metaAccountId: account.id },
          },
          create: {
            id: mc.id,
            tenantId,
            name: mc.name,
            type: 'ADS',
            status: this.mapMetaStatus(mc.status),
            objective: mc.objective,
            startAt: mc.start_time ? new Date(mc.start_time) : undefined,
            endAt: mc.end_time ? new Date(mc.end_time) : undefined,
            config: { source: 'meta', metaAccountId: account.id },
          },
        });
        synced.push({ externalId: mc.id, name: mc.name, status: mc.status });
      }
    }

    this.eventBus.emit('integrations.meta.synced', { tenantId, count: synced.length });
    return synced;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getValidConnection(tenantId: string) {
    const connection = await this.prisma.oAuthConnection.findFirst({
      where: { tenantId, provider: 'meta' },
    });
    if (!connection || !connection.accessTokenEncrypted) {
      throw new BadRequestException('Meta not connected — please authenticate first');
    }

    // Refresh token if near expiry (within 7 days)
    if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
      return this.refreshAccessToken(tenantId, connection);
    }
    return connection;
  }

  private async refreshAccessToken(tenantId: string, connection: { accessTokenEncrypted: string }) {
    const refreshUrl = `${META_GRAPH_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: connection.accessTokenEncrypted,
      });
    const res = await fetch(refreshUrl, { method: 'GET' });
    if (!res.ok) return connection;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    await this.prisma.oAuthConnection.update({
      where: { tenantId_provider: { tenantId, provider: 'meta' } },
      data: { accessTokenEncrypted: data.access_token, tokenExpiresAt: expiresAt },
    });
    return { ...connection, accessTokenEncrypted: data.access_token };
  }

  private async getIntegration(tenantId: string) {
    return this.prisma.integration.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'meta' } },
    });
  }

  private mapObjective(objective: string): string {
    const map: Record<string, string> = {
      'AWARENESS': 'BRAND_AWARENESS',
      'TRAFFIC': 'LINK_CLICKS',
      'ENGAGEMENT': 'POST_ENGAGEMENT',
      'LEADS': 'LEAD_GENERATION',
      'SALES': 'OUTCOME_TRAFFIC',
      'CONVERSIONS': 'OUTCOME_TRAFFIC',
      'APP_INSTALLS': 'APP_INSTALLS',
    };
    return map[objective.toUpperCase()] || 'LINK_CLICKS';
  }

  private mapMetaStatus(status: string): string {
    const map: Record<string, string> = {
      'ACTIVE': 'ACTIVE',
      'PAUSED': 'PAUSED',
      'DELETED': 'CANCELLED',
      'ARCHIVED': 'COMPLETED',
    };
    return map[status] || 'DRAFT';
  }

  private extractActions(actions?: Array<{ action_type: string; value: string }>): Record<string, number> {
    if (!actions) return {};
    const result: Record<string, number> = {};
    for (const a of actions) {
      result[a.action_type] = Number(a.value);
    }
    return result;
  }
}
