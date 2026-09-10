/**
 * ZYRA — Domains Module
 * Custom domain management, CNAME verification, and SSL provisioning for storefronts
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
