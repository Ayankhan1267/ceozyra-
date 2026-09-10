import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantMiddleware } from './tenant.middleware';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware';

@Module({
  imports: [DatabaseModule],
  providers: [TenantMiddleware, RequestIdMiddleware, TenantService],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('*');
  }
}
