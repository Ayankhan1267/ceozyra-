/**
 * ZYRA — Tenant Guard
 *
 * Ensures every request carries tenant context.
 * Super admins may access endpoints without being tied to a tenant.
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: any }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Super admins can operate across all tenants without a specific tenantId
    if (user.role === 'SUPER_ADMIN') return true;

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    return true;
  }
}
