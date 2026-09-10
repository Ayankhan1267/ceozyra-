/**
 * ZYRA — Customer Module (CRM)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
