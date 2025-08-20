# apps/api/src/files/files.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

# apps/api/src/files/files.controller.ts
import { Controller, Post, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentOrg } from '../common/decorators/current-org.decorator';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('signed-url')
  @ApiOperation({ summary: 'Generate signed URL for file upload' })
  async generateSignedUploadUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @CurrentOrg() orgId: string,
  ) {
    return this.filesService.generateSignedUploadUrl(filename, contentType, orgId);
  }

  @Get(':key/signed-url')
  @ApiOperation({ summary: 'Generate signed URL for file download' })
  async generateSignedDownloadUrl(@Param('key') key: string) {
    return this.filesService.generateSignedDownloadUrl(key);
  }

  @Get(':key/metadata')
  @ApiOperation({ summary: 'Get file metadata' })
  async getFileMetadata(@Param('key') key: string) {
    return this.filesService.getFileMetadata(key);
  }
}

# apps/api/src/files/files.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Adapter } from '@hunters-run/integrations';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
  private s3Adapter: S3Adapter;

  constructor(private configService: ConfigService) {
    this.s3Adapter = new S3Adapter(
      configService.get('AWS_S3_BUCKET')!,
      configService.get('AWS_REGION')!,
      configService.get('AWS_ACCESS_KEY_ID')!,
      configService.get('AWS_SECRET_ACCESS_KEY')!,
    );
  }

  async generateSignedUploadUrl(filename: string, contentType: string, orgId: string) {
    const key = `${orgId}/${uuidv4()}-${filename}`;
    const signedUrl = await this.s3Adapter.generateSignedUrl(key, 'put', 3600);
    
    return {
      key,
      signedUrl,
      expiresIn: 3600,
    };
  }

  async generateSignedDownloadUrl(key: string) {
    const signedUrl = await this.s3Adapter.generateSignedUrl(key, 'get', 3600);
    
    return {
      signedUrl,
      expiresIn: 3600,
    };
  }

  async getFileMetadata(key: string) {
    return this.s3Adapter.getMetadata(key);
  }

  async uploadFile(key: string, buffer: Buffer, contentType: string) {
    return this.s3Adapter.upload({
      key,
      buffer,
      contentType,
    });
  }

  async downloadFile(key: string) {
    return this.s3Adapter.download(key);
  }

  async deleteFile(key: string) {
    return this.s3Adapter.delete(key);
  }
}

# apps/api/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

# apps/api/src/notifications/notifications.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('email')
  @ApiOperation({ summary: 'Send email notification' })
  async sendEmail(@Body() emailData: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }) {
    return this.notificationsService.sendEmail(emailData);
  }

  @Post('sms')
  @ApiOperation({ summary: 'Send SMS notification' })
  async sendSMS(@Body() smsData: {
    to: string;
    message: string;
    from?: string;
  }) {
    return this.notificationsService.sendSMS(smsData);
  }

  @Post('bulk-email')
  @ApiOperation({ summary: 'Send bulk email notifications' })
  async sendBulkEmail(@Body() bulkEmailData: {
    emails: Array<{
      to: string;
      subject: string;
      html: string;
    }>;
  }) {
    return this.notificationsService.sendBulkEmail(bulkEmailData.emails);
  }
}

# apps/api/src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SendGridAdapter, TelnyxAdapter } from '@hunters-run/integrations';

@Injectable()
export class NotificationsService {
  private sendGridAdapter: SendGridAdapter;
  private telnyxAdapter: TelnyxAdapter;

  constructor(
    private configService: ConfigService,
    @InjectQueue('notifications') private notificationQueue: Queue,
  ) {
    this.sendGridAdapter = new SendGridAdapter(
      configService.get('SENDGRID_API_KEY')!,
    );
    
    this.telnyxAdapter = new TelnyxAdapter(
      configService.get('TELNYX_API_KEY')!,
    );
  }

  async sendEmail(emailData: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }) {
    const from = emailData.from || 'noreply@huntersrun.com';
    
    // Add to queue for async processing
    await this.notificationQueue.add('send-email', {
      to: emailData.to,
      from,
      subject: emailData.subject,
      html: emailData.html,
    });

    return { success: true, message: 'Email queued for delivery' };
  }

  async sendSMS(smsData: {
    to: string;
    message: string;
    from?: string;
  }) {
    const from = smsData.from || '+15551234567'; // Configure default SMS number
    
    // Add to queue for async processing
    await this.notificationQueue.add('send-sms', {
      to: smsData.to,
      from,
      message: smsData.message,
    });

    return { success: true, message: 'SMS queued for delivery' };
  }

  async sendBulkEmail(emails: Array<{
    to: string;
    subject: string;
    html: string;
  }>) {
    // Add to queue with batching
    await this.notificationQueue.add('send-bulk-email', {
      emails,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    return { success: true, message: `${emails.length} emails queued for delivery` };
  }

  // Direct methods for synchronous sending (used by processors)
  async sendEmailDirect(emailParams: any) {
    return this.sendGridAdapter.sendEmail(emailParams);
  }

  async sendSMSDirect(smsParams: any) {
    return this.telnyxAdapter.sendSMS(smsParams);
  }
}

# apps/api/src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'payments',
    }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

# apps/api/src/payments/payments.controller.ts
import { Controller, Post, Body, UseGuards, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { Request } from 'express';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Create payment intent' })
  async createPaymentIntent(@Body() paymentData: {
    amount: number;
    currency: string;
    customerId?: string;
    description?: string;
    metadata?: Record<string, string>;
  }) {
    return this.paymentsService.createPaymentIntent(paymentData);
  }

  @Post('create-customer')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Create Stripe customer' })
  async createCustomer(@Body() customerData: {
    email: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, string>;
  }) {
    return this.paymentsService.createCustomer(customerData);
  }

  @Post('webhook')
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req['rawBody'] || req.body;
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}

# apps/api/src/payments/payments.service.ts
import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { StripeAdapter } from '@hunters-run/integrations';
import { Logger } from 'pino';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripeAdapter: StripeAdapter;
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private configService: ConfigService,
    @InjectQueue('payments') private paymentQueue: Queue,
    @Inject('LOGGER') private logger: Logger,
  ) {
    const secretKey = configService.get('STRIPE_SECRET_KEY')!;
    this.stripeAdapter = new StripeAdapter(secretKey);
    this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    this.webhookSecret = configService.get('STRIPE_WEBHOOK_SECRET')!;
  }

  async createPaymentIntent(paymentData: {
    amount: number;
    currency: string;
    customerId?: string;
    description?: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const result = await this.stripeAdapter.createPaymentIntent({
        amount: paymentData.amount,
        currency: paymentData.currency,
        customerId: paymentData.customerId,
        description: paymentData.description,
        metadata: paymentData.metadata,
      });

      if (!result.success) {
        throw new BadRequestException(result.error);
      }

      return {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        status: result.status,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create payment intent');
      throw new BadRequestException('Failed to create payment intent');
    }
  }

  async createCustomer(customerData: {
    email: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const result = await this.stripeAdapter.createCustomer(customerData);

      if (!result.success) {
        throw new BadRequestException(result.error);
      }

      return {
        customerId: result.customerId,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create customer');
      throw new BadRequestException('Failed to create customer');
    }
  }

  async handleWebhook(rawBody: string | Buffer, signature: string) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );

      this.logger.info({ 
        eventType: event.type, 
        eventId: event.id 
      }, 'Stripe webhook received');

      // Queue webhook processing for async handling
      await this.paymentQueue.add('process-webhook', {
        eventType: event.type,
        eventId: event.id,
        data: event.data,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      return { received: true };
    } catch (error) {
      this.logger.error({ error, signature }, 'Webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async getPaymentStatus(paymentIntentId: string) {
    return this.stripeAdapter.getPaymentStatus(paymentIntentId);
  }

  async refundPayment(paymentIntentId: string, amount?: number) {
    return this.stripeAdapter.refundPayment(paymentIntentId, amount);
  }
}

# apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'not_ready', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

# apps/api/src/health/metrics.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  @Get()
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  getMetrics() {
    // Placeholder for Prometheus metrics
    // In production, integrate with @prometheus-io/client
    return `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 100
http_requests_total{method="POST",status="201"} 50

# HELP nodejs_memory_usage Memory usage in bytes
# TYPE nodejs_memory_usage gauge
nodejs_memory_usage{type="rss"} ${process.memoryUsage().rss}
nodejs_memory_usage{type="heapUsed"} ${process.memoryUsage().heapUsed}
nodejs_memory_usage{type="heapTotal"} ${process.memoryUsage().heapTotal}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}
    `.trim();
  }
}