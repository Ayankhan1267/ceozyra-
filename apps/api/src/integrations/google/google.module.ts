/**
 * ZYRA — Google Ads Integration Module
 *
 * Handles OAuth connection, campaign/ad-group/ad creation, and metrics sync
 * via Google Ads API v14.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';

import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';

@Module({
  imports: [DatabaseModule, EventModule],
  controllers: [GoogleController],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
