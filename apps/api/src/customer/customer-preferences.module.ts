/**
 * ZYRA — Customer Preferences Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CustomerPreferencesService } from './customer-preferences.service';
import { CustomerPreferencesController } from './customer-preferences.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CustomerPreferencesController],
  providers: [CustomerPreferencesService],
  exports: [CustomerPreferencesService],
})
export class CustomerPreferencesModule {}
