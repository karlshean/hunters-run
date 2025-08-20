# apps/worker/package.json
{
  "name": "@hunters-run/worker",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "start:dev": "ts-node src/main.ts",
    "dev": "ts-node src/main.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts --fix"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/bull": "^10.0.0",
    "bull": "^4.11.0",
    "redis": "^4.6.0",
    "pino": "^8.16.0",
    "@hunters-run/integrations": "workspace:*",
    "@hunters-run/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.0.0",
    "@types/node": "^20.3.1",
    "typescript": "^5.1.3",
    "ts-node": "^10.9.1"
  }
}

# apps/worker/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}

# apps/worker/Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/worker/package*.json ./apps/worker/
COPY packages/*/package*.json ./packages/*/
RUN npm ci

FROM base AS build
COPY . .
RUN npm run build --filter=@hunters-run/worker

FROM node:18-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001
COPY --from=build --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=build --chown=worker:nodejs /app/node_modules ./node_modules
COPY --chown=worker:nodejs apps/worker/package*.json ./
USER worker
ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# apps/worker/src/main.ts
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from 'pino';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, { bufferLogs: true });
  const logger = app.get<Logger>('LOGGER');

  // Start the worker
  await app.init();
  
  logger.info('🔧 Background worker started');
  logger.info('📋 Processing queues: notifications, payments');

  // Keep the process alive
  process.on('SIGTERM', async () => {
    logger.info('📋 Gracefully shutting down worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();

# apps/worker/src/worker.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { NotificationProcessor } from './processors/notification.processor';
import { PaymentProcessor } from './processors/payment.processor';
import { LoggerModule } from './logger/logger.module';

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
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'payments' },
    ),
  ],
  providers: [NotificationProcessor, PaymentProcessor],
})
export class WorkerModule {}

# apps/worker/src/logger/logger.module.ts
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

# apps/worker/src/processors/notification.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'pino';
import { SendGridAdapter, TelnyxAdapter } from '@hunters-run/integrations';

@Injectable()
@Processor('notifications')
export class NotificationProcessor {
  private sendGridAdapter: SendGridAdapter;
  private telnyxAdapter: TelnyxAdapter;

  constructor(
    private configService: ConfigService,
    @Inject('LOGGER') private logger: Logger,
  ) {
    this.sendGridAdapter = new SendGridAdapter(
      configService.get('SENDGRID_API_KEY')!,
    );
    
    this.telnyxAdapter = new TelnyxAdapter(
      configService.get('TELNYX_API_KEY')!,
    );
  }

  @Process('send-email')
  async handleSendEmail(job: Job) {
    const { to, from, subject, html } = job.data;
    
    this.logger.info({ jobId: job.id, to, subject }, 'Processing email job');
    
    try {
      const result = await this.sendGridAdapter.sendEmail({
        to,
        from,
        subject,
        html,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      this.logger.info({ 
        jobId: job.id, 
        messageId: result.messageId,
        to 
      }, 'Email sent successfully');

      return result;
    } catch (error) {
      this.logger.error({ 
        jobId: job.id, 
        error: error.message,
        to 
      }, 'Failed to send email');
      throw error;
    }
  }

  @Process('send-sms')
  async handleSendSMS(job: Job) {
    const { to, from, message } = job.data;
    
    this.logger.info({ jobId: job.id, to }, 'Processing SMS job');
    
    try {
      const result = await this.telnyxAdapter.sendSMS({
        to,
        from,
        message,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      this.logger.info({ 
        jobId: job.id, 
        messageId: result.messageId,
        to,
        cost: result.cost
      }, 'SMS sent successfully');

      return result;
    } catch (error) {
      this.logger.error({ 
        jobId: job.id, 
        error: error.message,
        to 
      }, 'Failed to send SMS');
      throw error;
    }
  }

  @Process('send-bulk-email')
  async handleSendBulkEmail(job: Job) {
    const { emails } = job.data;
    
    this.logger.info({ 
      jobId: job.id, 
      emailCount: emails.length 
    }, 'Processing bulk email job');
    
    try {
      const results = await this.sendGridAdapter.sendBulkEmail({
        emails,
        batchSize: 100,
      });

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.info({ 
        jobId: job.id, 
        successCount,
        failureCount,
        totalCount: results.length
      }, 'Bulk email job completed');

      return { results, successCount, failureCount };
    } catch (error) {
      this.logger.error({ 
        jobId: job.id, 
        error: error.message,
        emailCount: emails.length
      }, 'Failed to send bulk emails');
      throw error;
    }
  }
}

# apps/worker/src/processors/payment.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'pino';

@Injectable()
@Processor('payments')
export class PaymentProcessor {
  constructor(
    private configService: ConfigService,
    @Inject('LOGGER') private logger: Logger,
  ) {}

  @Process('process-webhook')
  async handleWebhook(job: Job) {
    const { eventType, eventId, data } = job.data;
    
    this.logger.info({ 
      jobId: job.id, 
      eventType, 
      eventId 
    }, 'Processing Stripe webhook');
    
    try {
      // Process different webhook event types
      switch (eventType) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(data.object);
          break;
        case 'customer.created':
          await this.handleCustomerCreated(data.object);
          break;
        default:
          this.logger.info({ eventType }, 'Unhandled webhook event type');
      }

      this.logger.info({ 
        jobId: job.id, 
        eventType, 
        eventId 
      }, 'Webhook processed successfully');

    } catch (error) {
      this.logger.error({ 
        jobId: job.id, 
        eventType, 
        eventId,
        error: error.message 
      }, 'Failed to process webhook');
      throw error;
    }
  }

  private async handlePaymentSucceeded(paymentIntent: any) {
    // Update payment status in database
    // Send confirmation notifications
    // Update tenant account balance
    this.logger.info({ 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      customerId: paymentIntent.customer
    }, 'Payment succeeded');
  }

  private async handlePaymentFailed(paymentIntent: any) {
    // Update payment status in database
    // Send failure notifications
    // Trigger retry or collections process
    this.logger.info({ 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      customerId: paymentIntent.customer
    }, 'Payment failed');
  }

  private async handleCustomerCreated(customer: any) {
    // Link Stripe customer to tenant record
    this.logger.info({ 
      customerId: customer.id,
      email: customer.email
    }, 'Customer created');
  }
}

# packages/shared/package.json
{
  "name": "@hunters-run/shared",
  "version": "1.0.0",
  "description": "Shared types and utilities",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "devDependencies": {
    "typescript": "^5.1.3",
    "@types/node": "^20.3.1"
  }
}

# packages/shared/src/types/legal.types.ts
export type NoticeType = 
  | 'pay_or_quit'
  | 'cure_or_quit' 
  | 'unconditional_quit'
  | 'lease_violation'
  | 'non_renewal'
  | 'rent_increase'
  | 'entry_notice'
  | 'other';

export type NoticeStatus = 
  | 'draft'
  | 'issued'
  | 'served'
  | 'acknowledged'
  | 'expired'
  | 'complied'
  | 'filed';

export type ServiceMethod = 
  | 'personal'
  | 'substitute'
  | 'posting'
  | 'certified_mail'
  | 'email'
  | 'other';

export type ServiceResult = 
  | 'served'
  | 'refused'
  | 'not_home'
  | 'invalid_address'
  | 'other';

# packages/shared/src/types/common.types.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type EntityStatus = 
  | 'active'
  | 'inactive'
  | 'draft'
  | 'archived';

# packages/shared/src/utils/validation.ts
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

export const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

# infra/init.sql
-- Database initialization script
-- This runs when the PostgreSQL container starts

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS "platform";
CREATE SCHEMA IF NOT EXISTS "hr";

-- Set default privileges for new schemas
GRANT USAGE ON SCHEMA platform TO postgres;
GRANT USAGE ON SCHEMA hr TO postgres;

-- Create app settings function for RLS context
CREATE OR REPLACE FUNCTION set_config_if_exists(setting_name text, new_value text)
RETURNS text AS $$
BEGIN
  BEGIN
    PERFORM set_config(setting_name, new_value, true);
    RETURN new_value;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql;

# E2E TESTS

# apps/api/test/rls-isolation.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Property } from '../src/database/entities/property.entity';

describe('RLS Isolation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  
  const ORG_A_ID = '11111111-1111-1111-1111-111111111111';
  const ORG_B_ID = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env.DATABASE_URL,
          entities: [Property],
          synchronize: false,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = app.get(DataSource);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should enforce RLS isolation between organizations', async () => {
    // Create test data for Org A
    await dataSource.query(`SET app.current_org = '${ORG_A_ID}'`);
    await dataSource.query(`
      INSERT INTO hr.properties (organization_id, name, address, city, state, zip_code)
      VALUES ('${ORG_A_ID}', 'Org A Property', '123 Test St', 'Test City', 'TX', '12345')
    `);

    // Create test data for Org B
    await dataSource.query(`SET app.current_org = '${ORG_B_ID}'`);
    await dataSource.query(`
      INSERT INTO hr.properties (organization_id, name, address, city, state, zip_code)
      VALUES ('${ORG_B_ID}', 'Org B Property', '456 Test Ave', 'Test City', 'TX', '67890')
    `);

    // Test Org A can only see their data
    await dataSource.query(`SET app.current_org = '${ORG_A_ID}'`);
    const orgAProperties = await dataSource.query('SELECT * FROM hr.properties');
    expect(orgAProperties).toHaveLength(1);
    expect(orgAProperties[0].name).toBe('Org A Property');

    // Test Org B can only see their data
    await dataSource.query(`SET app.current_org = '${ORG_B_ID}'`);
    const orgBProperties = await dataSource.query('SELECT * FROM hr.properties');
    expect(orgBProperties).toHaveLength(1);
    expect(orgBProperties[0].name).toBe('Org B Property');

    // Test no org context returns no data
    await dataSource.query('RESET app.current_org');
    const noOrgProperties = await dataSource.query('SELECT * FROM hr.properties');
    expect(noOrgProperties).toHaveLength(0);
  });
});

# apps/api/test/legal-transitions.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { LegalModule } from '../src/legal/legal.module';
import { DatabaseModule } from '../src/database/database.module';

describe('Legal Notice Transitions (e2e)', () => {
  let app: INestApplication;
  let noticeId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, LegalModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create a test notice
    const response = await request(app.getHttpServer())
      .post('/legal/notices')
      .set('x-org-id', '11111111-1111-1111-1111-111111111111')
      .set('Authorization', 'Bearer test-token')
      .send({
        template_id: '11111111-1111-1111-1111-111111111111',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        property_id: '11111111-1111-1111-1111-111111111111',
        title: 'Test Notice',
        content: 'Test content',
      });

    noticeId = response.body.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow valid status transitions', async () => {
    // draft -> issued (valid)
    await request(app.getHttpServer())
      .patch(`/legal/notices/${noticeId}/status`)
      .set('x-org-id', '11111111-1111-1111-1111-111111111111')
      .set('Authorization', 'Bearer test-token')
      .send({ status: 'issued' })
      .expect(200);

    // issued -> served (valid)
    await request(app.getHttpServer())
      .patch(`/legal/notices/${noticeId}/status`)
      .set('x-org-id', '11111111-1111-1111-1111-111111111111')
      .set('Authorization', 'Bearer test-token')
      .send({ status: 'served' })
      .expect(200);
  });

  it('should reject invalid status transitions', async () => {
    // draft -> served (invalid - must go through issued)
    await request(app.getHttpServer())
      .patch(`/legal/notices/${noticeId}/status`)
      .set('x-org-id', '11111111-1111-1111-1111-111111111111')
      .set('Authorization', 'Bearer test-token')
      .send({ status: 'served' })
      .expect(400);
  });

  it('should prevent transitions from final states', async () => {
    // Move to filed status
    await request(app.getHttpServer())
      .patch(`/legal/notices/${noticeId}/status`)
      .set('x-org-id', '11111111-1111-1111-1111-111111111111')
      .set('Authorization', 'Bearer test-token')
      .send({ status: 'filed' })
      .expect(200);

    // Try to transition from filed (should fail)
    await request(app.getHttpServer())
      .patch(`/legal/notices/${noticeId}/status`)
      .set('x-org-id', '11111111-1111-1111-1111-111111111111')
      .set('Authorization', 'Bearer test-token')
      .send({ status: 'issued' })
      .expect(400);
  });
});

# apps/api/test/s3-signed-urls.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { S3Adapter } from '@hunters-run/integrations';
import { FilesService } from '../src/files/files.service';
import { ConfigService } from '@nestjs/config';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn().mockImplementation(() => ({
    getSignedUrl: jest.fn().mockImplementation((operation, params) => {
      const { Bucket, Key, Expires } = params;
      return `https://${Bucket}.s3.amazonaws.com/${Key}?expires=${Expires}&signature=mock`;
    }),
    upload: jest.fn().mockImplementation(() => ({
      promise: () => Promise.resolve({
        Location: 'https://test-bucket.s3.amazonaws.com/test-key',
        ETag: '"mock-etag"',
      }),
    })),
    getObject: jest.fn().mockImplementation(() => ({
      promise: () => Promise.resolve({
        Body: Buffer.from('test content'),
        ContentType: 'text/plain',
      }),
    })),
  })),
}));

describe('S3 Signed URLs', () => {
  let filesService: FilesService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                AWS_S3_BUCKET: 'test-bucket',
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test-access-key',
                AWS_SECRET_ACCESS_KEY: 'test-secret-key',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    filesService = module.get<FilesService>(FilesService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should generate signed upload URL', async () => {
    const result = await filesService.generateSignedUploadUrl(
      'test-file.jpg',
      'image/jpeg',
      'org-123'
    );

    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('signedUrl');
    expect(result).toHaveProperty('expiresIn', 3600);
    expect(result.key).toMatch(/^org-123\/.*-test-file\.jpg$/);
    expect(result.signedUrl).toContain('https://test-bucket.s3.amazonaws.com');
  });

  it('should generate signed download URL', async () => {
    const testKey = 'org-123/test-file.jpg';
    const result = await filesService.generateSignedDownloadUrl(testKey);

    expect(result).toHaveProperty('signedUrl');
    expect(result).toHaveProperty('expiresIn', 3600);
    expect(result.signedUrl).toContain('https://test-bucket.s3.amazonaws.com');
    expect(result.signedUrl).toContain(testKey);
  });

  it('should upload and download file successfully', async () => {
    const testKey = 'org-123/test-upload.txt';
    const testBuffer = Buffer.from('test file content');
    const contentType = 'text/plain';

    // Test upload
    const uploadResult = await filesService.uploadFile(testKey, testBuffer, contentType);
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.key).toBe(testKey);

    // Test download
    const downloadResult = await filesService.downloadFile(testKey);
    expect(downloadResult.success).toBe(true);
    expect(downloadResult.buffer).toEqual(Buffer.from('test content'));
  });
});

# apps/api/test/stripe-webhook.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../src/payments/payments.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn().mockImplementation((body, signature, secret) => {
        if (signature === 'valid-signature' && secret === 'test-webhook-secret') {
          return {
            id: 'evt_test',
            type: 'payment_intent.succeeded',
            data: {
              object: {
                id: 'pi_test',
                amount: 1000,
                currency: 'usd',
                status: 'succeeded',
              },
            },
          };
        }
        throw new Error('Invalid signature');
      }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test',
        client_secret: 'pi_test_client_secret',
        status: 'requires_payment_method',
      }),
    },
  }));
});

describe('Stripe Webhook Verification', () => {
  let paymentsService: PaymentsService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                STRIPE_SECRET_KEY: 'sk_test_123',
                STRIPE_WEBHOOK_SECRET: 'test-webhook-secret',
              };
              return config[key];
            }),
          },
        },
        {
          provide: getQueueToken('payments'),
          useValue: mockQueue,
        },
        {
          provide: 'LOGGER',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  it('should successfully verify valid webhook signature', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_test',
      type: 'payment_intent.succeeded',
    });
    const signature = 'valid-signature';

    const result = await paymentsService.handleWebhook(rawBody, signature);

    expect(result).toEqual({ received: true });
    expect(mockQueue.add).toHaveBeenCalledWith(
      'process-webhook',
      {
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test',
        data: {
          object: {
            id: 'pi_test',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
  });

  it('should reject invalid webhook signature', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_test',
      type: 'payment_intent.succeeded',
    });
    const signature = 'invalid-signature';

    await expect(paymentsService.handleWebhook(rawBody, signature))
      .rejects
      .toThrow('Invalid webhook signature');

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('should create payment intent successfully', async () => {
    const paymentData = {
      amount: 1000,
      currency: 'usd',
      description: 'Test payment',
    };

    const result = await paymentsService.createPaymentIntent(paymentData);

    expect(result).toEqual({
      paymentIntentId: 'pi_test',
      clientSecret: 'pi_test_client_secret',
      status: 'requires_payment_method',
    });
  });
});