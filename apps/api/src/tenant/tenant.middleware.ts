/**
 * ZYRA — Tenant Middleware
 * Extracts tenant from subdomain/host header and sets context
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';
import { TENANT_CONTEXT } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.hostname;

    // Check if it's a storefront subdomain
    const parts = host.split('.');
    let tenantSlug: string | null = null;

    if (parts.length > 2 || (parts.length === 2 && parts[0] !== 'www')) {
      tenantSlug = parts[0];
    }

    if (tenantSlug) {
      try {
        const tenant = await this.tenantService.findBySlug(tenantSlug);
        if (tenant) {
          (req as any).tenant = tenant;
          // Also set async context for Prisma middleware
          TENANT_CONTEXT.run({ tenantId: tenant.id, userId: null }, () => next());
          return;
        }
      } catch {
        // No tenant found — continue without tenant context
      }
    }

    // No tenant found in hostname — proceed without tenant context
    TENANT_CONTEXT.run({ tenantId: null, userId: null }, () => next());
  }
}
