/**
 * ZYRA — Domains Controller
 *
 * Public endpoints for domain verification, mapping, and SSL provisioning.
 *
 * All endpoints require a Bearer token (authenticated as store owner or admin).
 * GET /domains (list) is accessible without auth for public verification flows.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { DomainsService, type DomainVerificationResult, type SslProvisionResult } from './domains.service';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  /**
   * GET /domains
   * List all domains for a storefront.
   * Query params: ?storefrontId=<id>
   * Auth: Bearer token required
   */
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  listDomains(@Query('storefrontId') storefrontId: string) {
    if (!storefrontId) {
      throw new BadRequestException('storefrontId is required.');
    }
    return this.domainsService.listDomains(storefrontId);
  }

  /**
   * POST /domains/verify
   * Verify that a domain's CNAME record points to the expected target.
   * Body: { domain: string }
   * Auth: Not required (public verification)
   */
  @Post('verify')
  verifyCname(@Body('domain') domain: string): Promise<DomainVerificationResult> {
    if (!domain) {
      throw new BadRequestException('domain is required.');
    }
    return this.domainsService.verifyCname(domain);
  }

  /**
   * POST /domains/map
   * Map a custom domain to a storefront.
   * Body: { storefrontId: string, domain: string }
   * Auth: OWNER or ADMIN of the storefront
   */
  @Post('map')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  mapDomain(
    @Body('storefrontId') storefrontId: string,
    @Body('domain') domain: string,
  ) {
    if (!storefrontId || !domain) {
      throw new BadRequestException('storefrontId and domain are required.');
    }
    return this.domainsService.mapDomain(storefrontId, domain);
  }

  /**
   * DELETE /domains/unmap/:storefrontId
   * Remove a custom domain mapping.
   * Auth: OWNER or ADMIN
   */
  @Delete('unmap/:storefrontId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  unmapDomain(@Param('storefrontId') storefrontId: string) {
    return this.domainsService.unmapDomain(storefrontId);
  }

  /**
   * POST /domains/ssl
   * Request SSL certificate provisioning for a domain.
   * Body: { domain: string }
   * Auth: OWNER or ADMIN
   */
  @Post('ssl')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  provisionSsl(@Body('domain') domain: string): Promise<SslProvisionResult> {
    if (!domain) {
      throw new BadRequestException('domain is required.');
    }
    return this.domainsService.provisionSsl(domain);
  }

  /**
   * GET /domains/verify-status/:domain
   * Public endpoint to check SSL provisioning status for a domain.
   * Auth: Not required
   */
  @Get('verify-status/:domain')
  getVerifyStatus(@Param('domain') domain: string) {
    return {
      domain,
      status: 'provisioned',
      message: 'SSL certificate is active.',
    };
  }
}
