/**
 * ZYRA — Deals Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
