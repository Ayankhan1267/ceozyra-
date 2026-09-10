/**
 * ZYRA — Email Settings Service
 *
 * Per-tenant SMTP configuration. Each tenant can set their own outbound
 * SMTP so email can be sent FROM their own domain (e.g. noreply@rabtnaturals.com)
 * through the ZYRA platform. Falls back to the platform SMTP when unset.
 * Passwords are stored AES-256-GCM encrypted and decrypted only for the
 * owning tenant on read.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { PrismaService } from '../database/prisma.service';
import { encryptSecret, decryptSecret } from './email-crypto';
import { type SmtpConfig } from './email.service';

export interface EmailSettingsInput {
  host: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  dkimSelector?: string | null;
  dkimDomain?: string | null;
}

@Injectable()
export class EmailSettingsService {
  private readonly logger = new Logger(EmailSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string | null) {
    if (!tenantId) return null;
    const row = await this.prisma.tenantEmailConfig.findUnique({
      where: { tenantId },
    });
    if (!row) return null;
    return { ...row, password: decryptSecret(row.password) };
  }

  async saveSettings(tenantId: string | null, input: EmailSettingsInput) {
    if (!tenantId) {
      throw new Error('tenantId is required to save email settings');
    }
    if (!input.host) {
      throw new Error('host is required');
    }

    const existing = await this.prisma.tenantEmailConfig.findUnique({
      where: { tenantId },
    });

    const data = {
      host: input.host,
      port: input.port ?? 587,
      secure: input.secure ?? false,
      username: input.username ?? '',
      password: input.password ? encryptSecret(input.password) : existing?.password ?? '',
      fromEmail: input.fromEmail ?? '',
      fromName: input.fromName ?? '',
      dkimSelector: input.dkimSelector ?? null,
      dkimDomain: input.dkimDomain ?? null,
    };

    const row = await this.prisma.tenantEmailConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    return row;
  }

  async testSettings(tenantId: string | null, input?: Partial<EmailSettingsInput>) {
    const stored = tenantId
      ? await this.prisma.tenantEmailConfig.findUnique({ where: { tenantId } })
      : null;

    const host = input?.host ?? stored?.host;
    if (!host) {
      return { ok: false, message: 'host is required' };
    }

    const password =
      input?.password ?? (stored?.password ? decryptSecret(stored.password) : undefined);
    if (password === undefined || password === null) {
      return { ok: false, message: 'password is required (no existing password set)' };
    }

    const cfg = {
      host,
      port: input?.port ?? stored?.port ?? 587,
      secure: input?.secure ?? stored?.secure ?? false,
      user: input?.username ?? stored?.username ?? '',
      pass: password,
      tls: { rejectUnauthorized: false },
    };

    let transporter;
    try {
      transporter = createTransport(cfg);
      await transporter.verify();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SMTP verification failed';
      if (tenantId && stored) {
        await this.prisma.tenantEmailConfig.update({
          where: { tenantId },
          data: { verified: false, lastTestedAt: new Date(), lastError: message },
        });
      }
      return { ok: false, message };
    }

    if (tenantId && stored) {
      await this.prisma.tenantEmailConfig.update({
        where: { tenantId },
        data: { verified: true, lastTestedAt: new Date(), lastError: null },
      });
    }
    return { ok: true, message: 'SMTP connection verified successfully' };
  }

  getDnsGuide() {
    const platformSpfDomain = process.env.PLATFORM_SPF_DOMAIN || 'ceozyra.com';
    return {
      spf: {
        type: 'TXT',
        name: '@',
        value: `v=spf1 include:${platformSpfDomain} ~all`,
        ttl: '3600',
      },
      dkim: {
        type: 'TXT',
        name: 'zyra._domainkey (your chosen selector)',
        value: 'v=DKIM1; k=rsa; p=<public-key>',
        note: 'Use the selector and public key provided after enabling DKIM signing.',
      },
      dmarc: {
        type: 'TXT',
        name: '_dmarc',
        value: 'v=DMARC1; p=none; rua=mailto:dmarc@' + platformSpfDomain,
        ttl: '3600',
      },
      note: `Add these DNS records for your sending domain to maximise deliverability. Platform SPF include: ${platformSpfDomain}`,
    };
  }

  async getSmtpConfigForTenant(tenantId?: string): Promise<SmtpConfig | null> {
    if (!tenantId) return null;
    const row = await this.prisma.tenantEmailConfig.findUnique({ where: { tenantId } });
    if (!row || !row.enabled) return null;
    return {
      host: row.host,
      port: row.port,
      secure: row.secure,
      user: row.username,
      pass: decryptSecret(row.password),
      from: row.fromEmail,
      fromName: row.fromName || undefined,
    };
  }
}
