# apps/api/package.json
{
  "name": "@hunters-run/api",
  "version": "1.0.0",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "typeorm": "typeorm-ts-node-commonjs",
    "typeorm:run": "npm run typeorm migration:run -- -d src/database/data-source.ts",
    "typeorm:generate": "npm run typeorm migration:generate -- -d src/database/data-source.ts",
    "typeorm:create": "npm run typeorm migration:create",
    "seed": "ts-node src/database/seeds/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/swagger": "^7.1.0",
    "@nestjs/bull": "^10.0.0",
    "@nestjs/terminus": "^10.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "bull": "^4.11.0",
    "firebase-admin": "^11.10.0",
    "pino": "^8.16.0",
    "pino-http": "^8.5.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "uuid": "^9.0.0",
    "stripe": "^12.15.0",
    "@hunters-run/integrations": "workspace:*",
    "@hunters-run/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/supertest": "^2.0.12",
    "@types/uuid": "^9.0.0",
    "jest": "^29.5.0",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.3"
  }
}

# apps/api/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}

# apps/api/Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/*/package*.json ./packages/*/
RUN npm ci

FROM base AS build
COPY . .
RUN npm run build --filter=@hunters-run/api

FROM node:18-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs apps/api/package*.json ./
USER nestjs
EXPOSE 3000
ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get<Logger>('LOGGER');

  // Security & parsing
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new RequestContextInterceptor());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });

  // Raw body for Stripe webhooks
  app.use('/payments/webhook', (req, res, next) => {
    if (req.headers['content-type'] === 'application/json') {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        req['rawBody'] = data;
        next();
      });
    } else {
      next();
    }
  });

  // API Documentation
  const config = new DocumentBuilder()
    .setTitle('Hunters Run Property Management API')
    .setDescription('Enterprise property management platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.info(`🚀 API running on http://localhost:${port}`);
  logger.info(`📚 Documentation: http://localhost:${port}/api`);
}

bootstrap();

# apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from './database/database.module';
import { LegalModule } from './legal/legal.module';
import { FilesModule } from './files/files.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health/health.controller';
import { MetricsController } from './health/metrics.controller';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    TerminusModule,
    DatabaseModule,
    LegalModule,
    FilesModule,
    NotificationsModule,
    PaymentsModule,
  ],
  controllers: [HealthController, MetricsController],
})
export class AppModule {}

# apps/api/src/common/logger/logger.module.ts
import { Module, Global } from '@nestjs/common';
import { pino, Logger } from 'pino';

@Global()
@Module({
  providers: [
    {
      provide: 'LOGGER',
      useFactory: (): Logger => {
        return pino({
          level: process.env.LOG_LEVEL || 'info',
          transport: process.env.NODE_ENV === 'development' 
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        });
      },
    },
  ],
  exports: ['LOGGER'],
})
export class LoggerModule {}

# apps/api/src/common/interceptors/request-context.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { Logger } from 'pino';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(
    @Inject('LOGGER') private readonly logger: Logger,
    private readonly dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const requestId = uuidv4();
    const orgId = request.headers['x-org-id'];
    const userId = request.user?.sub;
    const startTime = Date.now();

    // Set request ID
    request.id = requestId;
    response.setHeader('x-request-id', requestId);

    // Set RLS context if org ID present
    let queryRunner;
    if (orgId) {
      queryRunner = this.dataSource.createQueryRunner();
      queryRunner.connect().then(() => {
        queryRunner.query(`SET LOCAL app.current_org = '${orgId}'`);
        if (userId) {
          queryRunner.query(`SET LOCAL app.current_user = '${userId}'`);
        }
      });
      request.queryRunner = queryRunner;
    }

    this.logger.info({
      requestId,
      method: request.method,
      url: request.url,
      orgId,
      userId,
      userAgent: request.headers['user-agent'],
    }, 'Request started');

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.info({
          requestId,
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          duration,
          orgId,
          userId,
        }, 'Request completed');
      }),
      finalize(async () => {
        if (queryRunner) {
          await queryRunner.release();
        }
      }),
    );
  }
}

# apps/api/src/common/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'pino';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject('LOGGER') private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any).message,
      requestId: request['id'],
    };

    // Log error with full context
    this.logger.error({
      ...errorResponse,
      orgId: request.headers['x-org-id'],
      userId: request['user']?.sub,
      stack: exception instanceof Error ? exception.stack : undefined,
      error: exception,
    }, 'Request failed');

    response.status(status).json(errorResponse);
  }
}

# apps/api/src/common/decorators/current-org.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-org-id'];
  },
);

# apps/api/src/auth/guards/firebase-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { FirebaseAuthAdapter } from '@hunters-run/integrations';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'pino';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private firebaseAuth: FirebaseAuthAdapter;

  constructor(
    private configService: ConfigService,
    @Inject('LOGGER') private logger: Logger,
  ) {
    this.firebaseAuth = new FirebaseAuthAdapter(
      configService.get('FIREBASE_PROJECT_ID')!,
      configService.get('FIREBASE_PRIVATE_KEY')!,
      configService.get('FIREBASE_CLIENT_EMAIL')!,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const result = await this.firebaseAuth.verifyToken(token);
      
      if (!result.success) {
        throw new UnauthorizedException('Invalid token');
      }

      request.user = {
        sub: result.uid,
        email: result.email,
        email_verified: result.email_verified,
        phone_number: result.phone_number,
        custom_claims: result.custom_claims,
      };

      return true;
    } catch (error) {
      this.logger.warn({ error: error.message }, 'Token verification failed');
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}