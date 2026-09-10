/**
 * ZYRA — Activities Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
