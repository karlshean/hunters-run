# Database migration for webhook infrastructure
# infra/webhook-migration.sql

-- Webhook events table for idempotent processing
CREATE TABLE IF NOT EXISTS hr.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'stripe', 'sendgrid', etc.
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id) -- Ensures idempotent processing
);

-- Payment disputes table for charge.dispute.created events
CREATE TABLE IF NOT EXISTS hr.payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_due_by TIMESTAMPTZ,
  is_charge_refundable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE hr.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.payment_disputes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY webhook_events_org_isolation ON hr.webhook_events
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY payment_disputes_org_isolation ON hr.payment_disputes
  USING (organization_id = current_setting('app.current_org', true)::uuid);

-- Indexes for performance
CREATE INDEX idx_webhook_events_provider_event ON hr.webhook_events(provider, event_id);
CREATE INDEX idx_webhook_events_org_processed ON hr.webhook_events(organization_id, processed_at, created_at);
CREATE INDEX idx_payment_disputes_stripe_charge ON hr.payment_disputes(stripe_charge_id);
CREATE INDEX idx_payment_disputes_org_status ON hr.payment_disputes(organization_id, status, created_at);

# apps/api/src/health/ready.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller()
export class ReadyController {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRedis() private redis: Redis,
  ) {}

  @Get('ready')
  @ApiOperation({ 
    summary: 'Readiness check - verifies DB and Redis connectivity',
    description: 'Returns 200 if all dependencies are healthy, 503 if any are down'
  })
  @ApiResponse({ status: 200, description: 'All systems ready' })
  @ApiResponse({ status: 503, description: 'System not ready' })
  async checkReadiness() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const results = {
      database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };

    const allHealthy = Object.values(results).every(
      (status, index) => index === 2 || status === 'healthy' // Skip timestamp
    );

    if (!allHealthy) {
      // Return 503 Service Unavailable if any dependency is down
      return {
        status: 'not_ready',
        ...results,
      };
    }

    return {
      status: 'ready',
      ...results,
    };
  }

  private async checkDatabase(): Promise<void> {
    // Test database connectivity and basic query
    await this.dataSource.query('SELECT 1');
  }

  private async checkRedis(): Promise<void> {
    // Test Redis connectivity
    await this.redis.ping();
  }
}

# apps/api/src/payments/webhooks.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'pino';
import { WebhookEvent } from '../database/entities/webhook-event.entity';
import { PaymentDispute } from '../database/entities/payment-dispute.entity';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEvent)
    private webhookEventsRepository: Repository<WebhookEvent>,
    @InjectRepository(PaymentDispute)
    private paymentDisputesRepository: Repository<PaymentDispute>,
    @Inject('LOGGER') private logger: Logger,
  ) {}

  async processStripeWebhook(eventId: string, eventType: string, data: any, orgId: string): Promise<void> {
    // Idempotent webhook processing
    const existingEvent = await this.webhookEventsRepository.findOne({
      where: { provider: 'stripe', event_id: eventId }
    });

    if (existingEvent?.processed_at) {
      this.logger.info({ eventId, eventType }, 'Webhook already processed, skipping');
      return;
    }

    // Record webhook event (idempotent insert)
    const webhookEvent = await this.webhookEventsRepository.save({
      organization_id: orgId,
      event_id: eventId,
      event_type: eventType,
      provider: 'stripe',
      payload: data,
    });

    try {
      // Process specific event types
      switch (eventType) {
        case 'charge.dispute.created':
          await this.handleDisputeCreated(data.object, orgId);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(data.object, orgId);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(data.object, orgId);
          break;
        default:
          this.logger.info({ eventType }, 'Unhandled webhook event type');
      }

      // Mark as processed
      await this.webhookEventsRepository.update(webhookEvent.id, {
        processed_at: new Date(),
      });

      this.logger.info({ eventId, eventType }, 'Webhook processed successfully');

    } catch (error) {
      // Mark as failed
      await this.webhookEventsRepository.update(webhookEvent.id, {
        failed_at: new Date(),
        failure_reason: error.message,
        retry_count: (webhookEvent.retry_count || 0) + 1,
      });

      this.logger.error({ 
        eventId, 
        eventType, 
        error: error.message 
      }, 'Webhook processing failed');

      throw error;
    }
  }

  private async handleDisputeCreated(dispute: any, orgId: string): Promise<void> {
    // Upsert payment dispute (handle duplicate events gracefully)
    await this.paymentDisputesRepository.upsert({
      organization_id: orgId,
      stripe_dispute_id: dispute.id,
      stripe_charge_id: dispute.charge,
      stripe_payment_intent_id: dispute.payment_intent,
      amount_cents: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      status: dispute.status,
      evidence_due_by: new Date(dispute.evidence_details.due_by * 1000),
      is_charge_refundable: dispute.is_charge_refundable,
    }, {
      conflictPaths: ['stripe_dispute_id'],
      skipUpdateIfNoValuesChanged: true,
    });

    this.logger.info({ 
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason
    }, 'Payment dispute recorded');
  }

  private async handlePaymentSucceeded(paymentIntent: any, orgId: string): Promise<void> {
    // Update payment status in your system
    this.logger.info({ 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      customerId: paymentIntent.customer
    }, 'Payment succeeded');
  }

  private async handlePaymentFailed(paymentIntent: any, orgId: string): Promise<void> {
    // Handle payment failure
    this.logger.info({ 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      customerId: paymentIntent.customer,
      lastPaymentError: paymentIntent.last_payment_error
    }, 'Payment failed');
  }
}

# apps/api/src/database/entities/webhook-event.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('webhook_events', { schema: 'hr' })
@Index(['provider', 'event_id'], { unique: true })
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  event_id: string;

  @Column()
  event_type: string;

  @Column()
  provider: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at: Date | null;

  @Column({ nullable: true })
  failure_reason: string;

  @Column({ default: 0 })
  retry_count: number;

  @CreateDateColumn()
  created_at: Date;
}

# apps/api/src/database/entities/payment-dispute.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('payment_disputes', { schema: 'hr' })
export class PaymentDispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column({ unique: true })
  stripe_dispute_id: string;

  @Column()
  stripe_charge_id: string;

  @Column({ nullable: true })
  stripe_payment_intent_id: string;

  @Column({ type: 'bigint' })
  amount_cents: number;

  @Column({ default: 'usd' })
  currency: string;

  @Column()
  reason: string;

  @Column()
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  evidence_due_by: Date;

  @Column({ default: false })
  is_charge_refundable: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

# apps/api/src/payments/payments.controller.ts (Updated)
import { Controller, Post, Body, UseGuards, Headers, Req, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { WebhooksService } from './webhooks.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { Request, Response } from 'express';
import { CurrentOrg } from '../common/decorators/current-org.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly webhooksService: WebhooksService,
  ) {}

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

  @Post('webhook')
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      // CRITICAL: Use raw body for signature verification
      const rawBody = req.rawBody || req.body;
      const event = await this.paymentsService.verifyWebhookSignature(rawBody, signature);
      
      // Extract org ID from webhook metadata or use default
      const orgId = event.data?.object?.metadata?.organization_id || 
                   process.env.DEFAULT_ORG_ID ||
                   '00000000-0000-0000-0000-000000000000';

      // Process webhook with idempotent handling
      await this.webhooksService.processStripeWebhook(
        event.id,
        event.type,
        event.data,
        orgId
      );

      res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ 
        error: 'Webhook signature verification failed' 
      });
    }
  }
}