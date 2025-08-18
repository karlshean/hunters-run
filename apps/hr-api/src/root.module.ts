import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./routes/health.controller";
import { WebhooksController } from "./routes/webhooks.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, WebhooksController],
  providers: []
})
export class AppModule {}