import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./routes/health.controller";
import { WebhooksController } from "./routes/webhooks.controller";
import { WorkOrdersController } from "./routes/work-orders.controller";
import { WorkOrdersService } from "./services/work-orders.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, WebhooksController, WorkOrdersController],
  providers: [WorkOrdersService]
})
export class AppModule {}