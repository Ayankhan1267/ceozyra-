/**
 * ZYRA — RBAC Module
 *
 * Exports granular permission guards and decorators for use across the API.
 *
 * Usage in any module:
 *   imports: [RbacModule]
 *
 * Usage on a controller:
 *   @UseGuards(AuthGuard, PermissionsGuard)
 *   @RequirePermission('products', 'create')
 *   createProduct(...) { ... }
 */

import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RbacService } from './rbac.service';
import { PermissionsGuard } from './permissions.guard';
import { TenantGuard } from './tenant.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { RequirePermission, RequireSuperAdmin } from './permissions.decorator';

@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  providers: [RbacService, PermissionsGuard, TenantGuard, SuperAdminGuard],
  exports: [RbacService, PermissionsGuard, TenantGuard, SuperAdminGuard],
})
export class RbacModule {}
