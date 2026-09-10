/**
 * ZYRA — Recommendations Module (Phase 3.3)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [DatabaseModule, EventModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
