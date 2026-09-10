/**
 * ZYRA — Meta (Facebook/Instagram) Integration Module
 *
 * Handles OAuth connection, campaign/ad-set/ad creation, and insights sync
 * via Meta Marketing API v18+ (Graph API).
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';

import { MetaService } from './meta.service';
import { MetaController } from './meta.controller';

@Module({
  imports: [DatabaseModule, EventModule],
  controllers: [MetaController],
  providers: [MetaService],
  exports: [MetaService],
})
export class MetaModule {}
