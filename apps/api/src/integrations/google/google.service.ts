/**
 * ZYRA — Google Ads Integration Service
 *
 * Handles OAuth connection, campaign/ad-group/ad creation, and metrics sync
 * via Google Ads API v14.
 *
 * Env vars required:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *
 * OAuth scopes requested:
 *   https://www.googleapis.com/auth/adwords
 *
 * Note: Google Ads API requires a developer token in addition to OAuth.
 * Set GOOGLE_ADS_DEVELOPER_TOKEN env var for production use.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v14';

interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}

interface GoogleAdWordsCustomer {
  customerClient: { customerClientId: string; descriptiveName: string };
  resourceName: string;
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly developerToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — GoogleService will operate in stub mode.');
    }
  }

  // ── OAuth ─────────────────────────────────────────────────────────────────

  /**
   * Exchange authorization code for access + refresh tokens.
   * Stores OAuthConnection + Integration record in the database.
   */
  async connectOAuth(tenantId: string, code: string, redirectUri: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Google OAuth credentials not configured');
    }

    try {
      const tokenRes = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const error = await tokenRes.text();
        throw new BadRequestException(`Google token exchange failed: ${error}`);
      }

      const token = (await tokenRes.json()) as GoogleOAuthTokenResponse;
      const expiresAt = new Date(Date.now() + token.expires_in * 1000);

      // Fetch user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const userData = (await userRes.json()) as { email: string; name: string };

      const integration = await this.prisma.integration.upsert({
        where: { tenantId_provider: { tenantId, provider: 'google' } },
        update: { status: 'CONNECTED', isEnabled: true, name: `Google Ads (${userData.email})` },
        create: { tenantId, provider: 'google', name: `Google Ads (${userData.email})`, status: 'CONNECTED', isEnabled: true },
      });

      await this.prisma.oAuthConnection.upsert({
        where: { id: `${tenantId}-google` },
        update: {
          provider: 'google',
          status: 'CONNECTED',
          scope: token.scope,
          accessTokenEncrypted: token.access_token,
          refreshTokenEncrypted: token.refresh_token,
          tokenExpiresAt: expiresAt,
          externalAccountId: userData.email,
        },
        create: {
          id: `${tenantId}-google`,
          tenantId,
          integrationId: integration.id,
          provider: 'google',
          status: 'CONNECTED',
          scope: token.scope,
          accessTokenEncrypted: token.access_token,
          refreshTokenEncrypted: token.refresh_token,
          tokenExpiresAt: expiresAt,
          externalAccountId: userData.email,
        },
      });

      this.eventBus.emit('integration.connected', { tenantId, provider: 'google', integrationId: integration.id });
      return { integration, connected: true };
    } catch (error: any) {
      this.logger.error(`Google OAuth connect failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Google OAuth failed: ${error.message}`);
    }
  }

  // ── Campaign / AdGroup / Ad Creation ──────────────────────────────────────

  /**
   * Create a Google Ads campaign.
   * Uses Google Ads REST API mutate operation.
   */
  async createCampaign(
    tenantId: string,
    customerId: string,
    name: string,
    budgetAmountMicros: number,
    status: string = 'PAUSED',
  ) {
    const accessToken = await this.getAccessToken(tenantId);
    const customerResource = `customers/${customerId}`;

    const campaignOp = {
      create: {
        name,
        status: status === 'ACTIVE' ? 'ENABLED' : 'PAUSED',
        advertising_channel_type: 'SEARCH',
        campaign_budget: customerResource + '/campaignBudgets/0',
        start_date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      },
    };

    const res = await fetch(
      `${GOOGLE_ADS_BASE}/${customerResource}/campaigns:mutate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ operations: [campaignOp] }),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Google createCampaign failed: ${error}`);
    }

    const result = (await res.json()) as { results: Array<{ resourceName: string }> };
    return { externalId: result.results[0]?.resourceName, name };
  }

  async createAdGroup(
    tenantId: string,
    customerId: string,
    campaignResourceName: string,
    name: string,
    cpcBidMicros: number,
  ) {
    const accessToken = await this.getAccessToken(tenantId);
    const customerResource = `customers/${customerId}`;

    const adGroupOp = {
      create: {
        name,
        campaign: campaignResourceName,
        status: 'PAUSED',
        cpc_bid_micros: cpcBidMicros,
        targeting_setting: { target_restrictions: [{ is_restriction: true, type: 'LOCATION' }] },
      },
    };

    const res = await fetch(
      `${GOOGLE_ADS_BASE}/${customerResource}/adGroups:mutate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ operations: [adGroupOp] }),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Google createAdGroup failed: ${error}`);
    }

    const result = (await res.json()) as { results: Array<{ resourceName: string }> };
    return { externalId: result.results[0]?.resourceName, name };
  }

  async createAd(
    tenantId: string,
    customerId: string,
    adGroupResourceName: string,
    headline1: string,
    headline2: string,
    description: string,
    finalUrl: string,
    zyraAdId: string,
  ) {
    const accessToken = await this.getAccessToken(tenantId);
    const customerResource = `customers/${customerId}`;

    const adOp = {
      create: {
        ad_group: adGroupResourceName,
        status: 'PAUSED',
        ad: {
          expanded_text_ad: {
            headline: { part: [{ text: headline1, index: 0 }] },
            description: { part: [{ text: description, index: 0 }] },
            path1: '',
          },
        },
        url_settings: { final_urls: { url: finalUrl } },
      },
    };

    const res = await fetch(
      `${GOOGLE_ADS_BASE}/${customerResource}/adGroupAds:mutate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ operations: [adOp] }),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Google createAd failed: ${error}`);
    }

    const result = (await res.json()) as { results: Array<{ resourceName: string }> };
    const externalId = result.results[0]?.resourceName;
    await this.prisma.ad.updateMany({ where: { id: zyraAdId, tenantId }, data: { externalId } });
    return { externalId };
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  /**
   * Fetch campaign metrics from Google Ads.
   * Returns impressions, clicks, cost, cpc, ctr by date.
   */
  async getCampaignMetrics(tenantId: string, customerId: string, campaignResourceName: string) {
    const accessToken = await this.getAccessToken(tenantId);

    const query = `
      SELECT
        campaign.name,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.average_cpc_micros,
        metrics.ctr
      FROM campaign
      WHERE campaign.resource_name = '${campaignResourceName}'
      AND segments.date DURING LAST_30_DAYS
    `;

    const res = await fetch(
      `${GOOGLE_ADS_BASE}/customers/${customerId}/search:searchStream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Google getCampaignMetrics failed: ${error}`);
    }

    const data = (await res.json()) as { results: Array<{ campaign: { name: string }; segments: { date: string }; metrics: { impressions: number; clicks: number; costMicros: number; averageCpcMicros: number; ctr: number } }> };
    return data.results.map((r) => ({
      campaignName: r.campaign.name,
      date: r.segments.date,
      impressions: r.metrics.impressions,
      clicks: r.metrics.clicks,
      cost: r.metrics.costMicros / 1_000_000,
      cpc: r.metrics.averageCpcMicros / 1_000_000,
      ctr: r.metrics.ctr,
    }));
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  /**
   * Sync all Google Ads campaigns for a tenant.
   */
  async syncCampaigns(tenantId: string) {
    const connection = await this.getValidConnection(tenantId);
    const integration = await this.getIntegration(tenantId);
    if (!integration.isEnabled) throw new BadRequestException('Google integration is disabled');

    const externalAccountId = connection.externalAccountId || '';
    // Query GAQL for campaigns
    const accessToken = await this.getAccessToken(tenantId);
    const customerId = externalAccountId.replace(/[^0-9]/g, '');

    const query = `
      SELECT campaign.name, campaign.status, campaign.id, campaign.advertising_channel_type
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `;

    const res = await fetch(
      `${GOOGLE_ADS_BASE}/customers/${customerId}/search:search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Google syncCampaigns failed: ${error}`);
    }

    const data = (await res.json()) as { results: Array<{ campaign: { name: string; id: string; status: string; advertisingChannelType: string } }> };
    const synced: { externalId: string; name: string; status: string }[] = [];

    for (const row of data.results) {
      const gaStatus = row.campaign.status === 'ENABLED' ? 'ACTIVE' : row.campaign.status === 'PAUSED' ? 'PAUSED' : 'CANCELLED';
      await this.prisma.campaign.upsert({
        where: { id: row.campaign.id },
        update: {
          name: row.campaign.name,
          status: gaStatus as any,
          objective: row.campaign.advertisingChannelType,
          config: { source: 'google', customerId },
        },
        create: {
          id: row.campaign.id,
          tenantId,
          name: row.campaign.name,
          type: 'ADS',
          status: gaStatus as any,
          objective: row.campaign.advertisingChannelType,
          config: { source: 'google', customerId },
        },
      });
      synced.push({ externalId: row.campaign.id, name: row.campaign.name, status: row.campaign.status });
    }

    this.eventBus.emit('integrations.google.synced', { tenantId, count: synced.length });
    return synced;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getAccessToken(tenantId: string): Promise<string> {
    const connection = await this.prisma.oAuthConnection.findFirst({
      where: { tenantId, provider: 'google' },
    });
    if (!connection?.accessTokenEncrypted) {
      throw new BadRequestException('Google Ads not connected — please authenticate first');
    }

    // Refresh if near expiry
    if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date(Date.now() + 5 * 60 * 1000)) {
      if (!connection.refreshTokenEncrypted) throw new BadRequestException('No refresh token available');
      const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: connection.refreshTokenEncrypted,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as GoogleOAuthTokenResponse;
        const expiresAt = new Date(Date.now() + data.expires_in * 1000);
        await this.prisma.oAuthConnection.update({
          where: { tenantId_provider: { tenantId, provider: 'google' } },
          data: { accessTokenEncrypted: data.access_token, tokenExpiresAt: expiresAt },
        });
        return data.access_token;
      }
    }
    return connection.accessTokenEncrypted;
  }

  private async getIntegration(tenantId: string) {
    return this.prisma.integration.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'google' } },
    });
  }
}
