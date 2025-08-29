import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./root.module";
import * as bodyParser from "body-parser";
import { AppDataSource } from "@platform/db/src/datasource";
// import Redis from "ioredis";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Stripe webhook: raw body
  app.use('/api/payments/webhook', bodyParser.raw({ type: 'application/json' }));
  // JSON for everything else
  app.use(bodyParser.json());

  await AppDataSource.initialize().catch((e)=>{ console.error("DB init error", e); });

  // Attach Redis for readiness checks (disabled for now)
  (app as any).locals = { redis: { ping: () => Promise.resolve('PONG') } };

  // app.setGlobalPrefix("api"); // Disabled - routes already include /api
  await app.listen(process.env.PORT || 3000);
}
bootstrap();