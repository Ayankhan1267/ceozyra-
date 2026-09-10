/**
 * ZYRA — Permissions Guard
 *
 * Checks granular resource+action permissions from the Permission table.
 * Super admins (SUPER_ADMIN role) bypass all permission checks.
 *
 * Decorated with @RequirePermission('resource', 'action') on route handlers.
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from './rbac.service';
import { PERMISSIONS_KEY, type PermissionMetadata } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<PermissionMetadata>(PERMISSIONS_KEY, context.getHandler());

    // No permission decorator on this route — allow
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{ user?: any }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const tenantId = user.tenantId ?? null;

    // Super admins bypass all permission checks
    if (user.role === 'SUPER_ADMIN') return true;

    const hasPermission = await this.rbacService.hasPermission(
      user.id,
      tenantId,
      required.resource,
      required.action,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing permission: ${required.resource}:${required.action}`,
      );
    }

    return true;
  }
}
