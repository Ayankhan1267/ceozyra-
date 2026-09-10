import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { StorefrontModule } from './storefront/storefront.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { CartModule } from './cart/cart.module';
import { CustomerModule } from './customer/customer.module';
import { StoresModule } from './stores/stores.module';
import { CategoriesModule } from './categories/categories.module';
import { CollectionsModule } from './collections/collections.module';
import { DomainsModule } from './domains/domains.module';
import { PaymentsModule } from './payments/payments.module';
import { CommissionModule } from './commission/commission.module';
import { AgentModule } from './agent/agent.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommunicationModule } from './communication/communication.module';
import { FinanceModule } from './finance/finance.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { EventModule } from './event/event.module';

import { LeadsModule } from './leads/leads.module';
import { CompaniesModule } from './companies/companies.module';
import { SegmentsModule } from './segments/segments.module';
import { ActivitiesModule } from './activities/activities.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { DealsModule } from './deals/deals.module';
import { TagsModule } from './tags/tags.module';
import { CrmModule } from './crm/crm.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { TemplatesModule } from './templates/templates.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AutomationModule } from './automation/automation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '.env.qa', '.env.production'],
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    EventModule,
    HealthModule,
    AuthModule,
    RbacModule,
    TenantModule,
    UserModule,
    StorefrontModule,
    ProductModule,
    OrderModule,
    CartModule,
    CustomerModule,
    CommissionModule,
    AgentModule,
    AnalyticsModule,
    CommunicationModule,
    FinanceModule,
    StoresModule,
    CategoriesModule,
    CollectionsModule,
    DomainsModule,
    PaymentsModule,
    InventoryModule,
    LeadsModule,
    CompaniesModule,
    SegmentsModule,
    ActivitiesModule,
    PipelineModule,
    DealsModule,
    TagsModule,
    CrmModule,
    ConversationsModule,
    MessagesModule,
    TemplatesModule,
    CampaignsModule,
    AutomationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
