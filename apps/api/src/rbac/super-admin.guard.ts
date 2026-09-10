/**
 * ZYRA — Super Admin Guard
 *
 * Restricts a route handler to users with the SUPER_ADMIN role only.
 * Use @UseGuards(SuperAdminGuard) directly or combine with @RequireSuperAdmin().
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: any }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Allow @RequireSuperAdmin() metadata override
    const flag = this.reflector.get<boolean>('requireSuperAdmin', context.getHandler());
    if (flag === false) return true;

    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
