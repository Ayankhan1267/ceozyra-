/**
 * ZYRA — RBAC Service
 *
 * Provides granular permission checks by looking up the Permission table
 * keyed by role (global, not per-tenant). Super admins always pass.
 */

import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Role } from '@prisma/client';

/**
 * In-memory LRU-style cache: role → Set of "resource:action" strings.
 * Permissions change rarely; caching avoids a DB hit on every guarded request.
 * Cache is invalidated when permissions are (re)seeded in production.
 */
const permissionCache = new Map<string, Set<string>>();

function cacheKey(role: Role): string {
  return role;
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all permission strings ("resource:action") granted to the given role.
   * Cached after first lookup for the lifetime of the API process.
   */
  async getRolePermissions(role: Role): Promise<string[]> {
    const cached = permissionCache.get(cacheKey(role));
    if (cached) return Array.from(cached);

    const perms = await this.prisma.permission.findMany({
      where: { role },
      select: { resource: true, action: true },
    });

    const set = new Set<string>(perms.map((p) => `${p.resource}:${p.action}`));
    permissionCache.set(cacheKey(role), set);

    return Array.from(set);
  }

  /**
   * Returns the set of permissions for the user's current role.
   * tenantId is accepted for forward-compat (Permission model is currently global per role).
   */
  async getPermissions(userId: string, tenantId: string | null): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return [];

    return this.getRolePermissions(user.role);
  }

  /**
   * Checks whether a user (by their current role) holds a specific resource+action permission.
   * Super admins always return true.
   *
   * @param userId  - The user to check
   * @param tenantId - tenant context (currently unused; kept for forward compat)
   * @param resource - e.g. 'products', 'orders'
   * @param action   - e.g. 'create', 'read', 'update', 'delete'
   */
  async hasPermission(
    userId: string,
    tenantId: string | null,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    // Super admins bypass every check
    if (user.role === 'SUPER_ADMIN') return true;

    const perms = await this.getRolePermissions(user.role);
    return perms.includes(`${resource}:${action}`);
  }

  /**
   * Assigns (or updates) the role for a user.
   */
  async assignRole(userId: string, role: Role): Promise<{ id: string; email: string; role: Role }> {
    // Validate role is a real Role enum value
    if (!Object.values(Role).includes(role)) {
      throw new ForbiddenException(`Invalid role: ${role}`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    return updated;
  }

  /**
   * Clears the permission cache. Call this after bulk permission updates or re-seeding.
   */
  clearCache(): void {
    permissionCache.clear();
  }
}
