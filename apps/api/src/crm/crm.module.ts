/**
 * ZYRA — CRM Module
 * Aggregates Leads, Companies, Segments, Activities, Pipeline, Deals, and Tags.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { CustomerModule } from '../customer/customer.module';
import { ActivitiesModule } from '../activities/activities.module';
import { CompaniesModule } from '../companies/companies.module';
import { LeadsModule } from '../leads/leads.module';
import { SegmentsModule } from '../segments/segments.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { DealsModule } from '../deals/deals.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [
    DatabaseModule,
    LeadsModule,
    CompaniesModule,
    SegmentsModule,
    ActivitiesModule,
    PipelineModule,
    DealsModule,
    TagsModule,
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
