/**
 * ZYRA — Integrations Module
 *
 * Barrel module that aggregates all third-party integration modules.
 * Currently includes: Meta (Facebook/Instagram), Google Ads.
 */

import { Module } from '@nestjs/common';
import { MetaModule } from './meta/meta.module';
import { GoogleModule } from './google/google.module';

@Module({
  imports: [MetaModule, GoogleModule],
  controllers: [],
  providers: [],
  exports: [MetaModule, GoogleModule],
})
export class IntegrationsModule {}
