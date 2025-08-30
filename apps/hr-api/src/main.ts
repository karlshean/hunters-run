import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from "./root.module";
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from "body-parser";
import { AppDataSource } from "@platform/db/src/datasource";
import { corsOptions, rateLimiters } from "./middleware/security.middleware";
// import Redis from "ioredis";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'] // Enhanced logging in production
  });
  
  // CORS configuration with allowlist
  app.enableCors(corsOptions);
  
  // Rate limiting - apply different limits to different routes
  app.use('/api/v1', rateLimiters.general);
  app.use('/api/v1/work-orders', rateLimiters.write); // Stricter for writes
  app.use('/api/auth', rateLimiters.auth); // Very strict for auth
  app.use('/api/webhooks', rateLimiters.webhook);
  
  // Trust proxy for rate limiting and IP detection
  app.set('trust proxy', 1);
  
  // Global validation pipe with transform
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));
  
  // Body parsing middleware
  // Stripe webhook: raw body
  app.use('/api/payments/webhook', bodyParser.raw({ type: 'application/json' }));
  // JSON for everything else with size limit
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

  await AppDataSource.initialize().catch((e)=>{ console.error("DB init error", e); });

  // Attach Redis for readiness checks (disabled for now)
  (app as any).locals = { redis: { ping: () => Promise.resolve('PONG') } };

  // OpenAPI/Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Hunters Run HR API')
    .setDescription('Property management and work order system API')
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-org-id', in: 'header' },
      'organization'
    )
    .addApiKey(
      { type: 'apiKey', name: 'idempotency-key', in: 'header' },
      'idempotency'
    )
    .addServer('/api', 'API Base')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  // app.setGlobalPrefix("api"); // Disabled - routes already include /api
  await app.listen(process.env.PORT || 3000);
  
  console.log(`🚀 HR API running on port ${process.env.PORT || 3000}`);
  console.log(`📚 OpenAPI docs available at http://localhost:${process.env.PORT || 3000}/api/docs`);
}
bootstrap();