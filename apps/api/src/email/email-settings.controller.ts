/**
 * ZYRA — Email Settings Controller
 *
 * Endpoints:
 *   GET  /email/settings?tenantId=   — read tenant SMTP config (password decrypted)
 *   PUT  /email/settings             — save/upsert tenant SMTP config
 *   POST /email/settings/test        — verify SMTP (current or provided settings)
 *   GET  /email/settings/dns-guide   — SPF / DKIM / DMARC records to add
 */

import { Controller, Get, Put, Post, Body, Query, UseGuards } from '@nestjs/common';
import { EmailSettingsService } from './email-settings.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

export class SaveEmailSettingsDto {
  host!: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  dkimSelector?: string | null;
  dkimDomain?: string | null;
}

export class TestEmailSettingsDto {
  tenantId?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
}

@Controller('email')
export class EmailSettingsController {
  constructor(private readonly settingsService: EmailSettingsService) {}

  @Get('settings')
  @UseGuards(AuthGuard, RolesGuard)
  getSettings(@Query('tenantId') tenantId?: string) {
    return this.settingsService.getSettings(tenantId ?? null);
  }

  @Put('settings')
  @UseGuards(AuthGuard, RolesGuard)
  saveSettings(@Query('tenantId') tenantId: string, @Body() dto: SaveEmailSettingsDto) {
    return this.settingsService.saveSettings(tenantId ?? null, dto);
  }

  @Post('settings/test')
  @UseGuards(AuthGuard, RolesGuard)
  testSettings(@Query('tenantId') tenantId: string, @Body() dto: TestEmailSettingsDto) {
    const effectiveTenantId = dto.tenantId ?? tenantId ?? null;
    return this.settingsService.testSettings(effectiveTenantId, dto);
  }

  @Get('settings/dns-guide')
  @UseGuards(AuthGuard, RolesGuard)
  getDnsGuide() {
    return this.settingsService.getDnsGuide();
  }
}
