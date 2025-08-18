import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./root.module";
import * as bodyParser from "body-parser";
import { AppDataSource } from "@platform/db/src/datasource";
import Redis from "ioredis";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Stripe webhook: raw body
  app.use('/api/payments/webhook', bodyParser.raw({ type: 'application/json' }));
  // JSON for everything else
  app.use(bodyParser.json());

  await AppDataSource.initialize().catch((e)=>{ console.error("DB init error", e); });

  // Attach Redis for readiness checks
  (app as any).locals = { redis: new Redis(process.env.REDIS_URL || "redis://localhost:6379") };

  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT || 3000);
}
bootstrap();