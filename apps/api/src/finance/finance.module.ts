/**
 * ZYRA — Finance Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
