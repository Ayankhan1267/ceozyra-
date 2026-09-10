/**
 * ZYRA — Commission Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommissionService } from './commission.service';
import { CommissionController } from './commission.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
