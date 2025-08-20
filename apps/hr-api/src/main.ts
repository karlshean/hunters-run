import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for web UI (supports both :3001 and :3004 ports)
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3004'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-org-id', 'Authorization'],
    credentials: false, // Explicit security setting
  });
  
  app.setGlobalPrefix('api');
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`hr-api listening on http://localhost:${port}/api`);
}
bootstrap();
