import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./routes/health.controller";
import { WebhooksController } from "./routes/webhooks.controller";
import { WorkOrdersController } from "./routes/work-orders.controller";
import { WorkOrdersService } from "./services/work-orders.service";
import { RequestIdMiddleware } from "./middleware/request-id.middleware";
import { IdempotencyMiddleware } from "./middleware/idempotency.middleware";
import { SecurityMiddleware, CompressionMiddleware } from "./middleware/security.middleware";
import { MonitoringMiddleware } from "./middleware/monitoring.middleware";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, WebhooksController, WorkOrdersController],
  providers: [WorkOrdersService, SecurityMiddleware, CompressionMiddleware, MonitoringMiddleware]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply security headers first
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');
    
    // Apply compression for better performance
    consumer
      .apply(CompressionMiddleware)
      .forRoutes('*');
    
    // Apply monitoring/logging
    consumer
      .apply(MonitoringMiddleware)
      .forRoutes('*');
    
    // Apply request ID generation
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('*');
    
    // Apply idempotency protection to v1 API routes
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes('api/v1/*');
  }
}