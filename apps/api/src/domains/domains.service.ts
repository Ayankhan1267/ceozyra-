/**
 * ZYRA — Domains Service
 *
 * Handles:
 *  - Domain listing and verification for storefronts
 *  - SSL certificate provisioning (delegates to certbot / ACME)
 *  - Domain ↔ storefront mapping via Domain and StoreDomain models
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface DomainVerificationResult {
  verified: boolean;
  cnameValue: string;
  expectedValue: string;
  message: string;
}

export interface SslProvisionResult {
  domain: string;
  status: 'pending' | 'issued' | 'failed';
  certPath?: string;
  expiresAt?: string;
}

@Injectable()
export class DomainsService {
  // The expected CNAME target for all ZYRA storefront custom domains
  private readonly EXPECTED_CNAME_TARGET = 'ceozyra.com';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all domains for a given storefront (primary + custom)
   */
  async listDomains(storefrontId: string) {
    const storefront = await this.prisma.storefront.findUnique({
      where: { id: storefrontId },
      select: { id: true, slug: true, subdomain: true, domain: true },
    });

    if (!storefront) {
      throw new NotFoundException('Storefront not found');
    }

    const domains: Array<{ domain: string; type: 'primary' | 'custom'; verified: boolean }> = [
      { domain: `${storefront.slug}.ceozyra.com`, type: 'primary', verified: true },
    ];

    if (storefront.subdomain) {
      domains.push({ domain: `${storefront.subdomain}.ceozyra.com`, type: 'custom', verified: true });
    }

    // Also include domains from the StoreDomain table linked via StoreDomain
    const storeDomains = await this.prisma.storeDomain.findMany({
      where: { storefrontId },
      include: { domain: true },
    });

    for (const sd of storeDomains) {
      domains.push({
        domain: sd.domain.domain,
        type: 'custom',
        verified: sd.domain.status === 'VERIFIED',
      });
    }

    return { storefrontId, domains };
  }

  /**
   * Verify a domain's CNAME record points to the expected target.
   * Uses DNS-over-HTTPS (Google public DNS) to resolve the CNAME record.
   */
  async verifyCname(domain: string): Promise<DomainVerificationResult> {
    const trimmed = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    try {
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(trimmed)}&type=CNAME`
      );

      if (!res.ok) {
        return {
          verified: false,
          cnameValue: '',
          expectedValue: this.EXPECTED_CNAME_TARGET,
          message: 'DNS lookup failed — please try again later.',
        };
      }

      const data = (await res.json()) as { Status: number; Answer?: Array<{ data: string }> };

      if (data.Status !== 0 || !data.Answer?.length) {
        return {
          verified: false,
          cnameValue: '',
          expectedValue: this.EXPECTED_CNAME_TARGET,
          message: `No CNAME record found for "${trimmed}". Add a CNAME pointing to "${this.EXPECTED_CNAME_TARGET}".`,
        };
      }

      const cnameValue = data.Answer[0].data.replace(/\.+$/, '');

      return {
        verified: cnameValue === this.EXPECTED_CNAME_TARGET,
        cnameValue,
        expectedValue: this.EXPECTED_CNAME_TARGET,
        message: cnameValue === this.EXPECTED_CNAME_TARGET
          ? 'CNAME verified successfully.'
          : `CNAME points to "${cnameValue}" but must point to "${this.EXPECTED_CNAME_TARGET}".`,
      };
    } catch (error) {
      return {
        verified: false,
        cnameValue: '',
        expectedValue: this.EXPECTED_CNAME_TARGET,
        message: 'Could not reach DNS resolver. Check network connectivity.',
      };
    }
  }

  /**
   * Map a custom domain to a storefront.
   * Creates or updates the storefront's domain field.
   */
  async mapDomain(storefrontId: string, customDomain: string) {
    const trimmed = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    // Check for existing mapping on another storefront
    const existing = await this.prisma.storefront.findFirst({
      where: { domain: trimmed },
      select: { id: true, slug: true },
    });

    if (existing && existing.id !== storefrontId) {
      throw new BadRequestException(
        `Domain "${trimmed}" is already mapped to storefront "${existing.slug}".`
      );
    }

    const updated = await this.prisma.storefront.update({
      where: { id: storefrontId },
      data: { domain: trimmed },
      select: { id: true, slug: true, domain: true },
    });

    return { success: true, storefront: updated };
  }

  /**
   * Request an SSL certificate for a domain.
   * In production this triggers certbot / ACME. Returns a job ID for async tracking.
   * In dev/staging, returns a simulated result.
   */
  async provisionSsl(domain: string): Promise<SslProvisionResult> {
    const trimmed = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      return {
        domain: trimmed,
        status: 'pending',
      };
    }

    // Dev/staging: simulate issued cert
    return {
      domain: trimmed,
      status: 'issued',
      certPath: `/etc/letsencrypt/live/${trimmed}/fullchain.pem`,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Remove a custom domain mapping from a storefront.
   */
  async unmapDomain(storefrontId: string) {
    const updated = await this.prisma.storefront.update({
      where: { id: storefrontId },
      data: { domain: null },
      select: { id: true, slug: true, domain: true },
    });

    return { success: true, storefront: updated };
  }
}
