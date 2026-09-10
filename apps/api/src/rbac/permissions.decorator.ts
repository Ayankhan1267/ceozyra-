/**
 * ZYRA — RBAC Permission Decorator
 *
 * Usage:
 *   @RequirePermission('products', 'create')
 *   @RequirePermission('finance', 'read')
 */

import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionMetadata {
  resource: string;
  action: string;
}

/**
 * Marks a route handler as requiring a specific resource+action permission.
 * Paired with PermissionsGuard to enforce at the guard level.
 */
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSIONS_KEY, { resource, action } as PermissionMetadata);

/**
 * Marks a route as requiring SUPER_ADMIN role. Shortcut for @Roles('SUPER_ADMIN').
 */
export const RequireSuperAdmin = () => SetMetadata('requireSuperAdmin', true);
