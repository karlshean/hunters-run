import {
  Controller,
  Post,
  Param,
  Req,
  RawBodyRequest,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { StripeService } from '../../common/stripe.service';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly config: ConfigService
  ) {}

  @Post('webhook')
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    const skipSignatureValidation = this.config.get<boolean>('ALLOW_INSECURE_STRIPE_WEBHOOK_TEST', false);
    
    let event: any;

    try {
      if (skipSignatureValidation) {
        // For testing/CI - parse payload directly without signature validation
        this.logger.warn('Webhook signature validation skipped (ALLOW_INSECURE_STRIPE_WEBHOOK_TEST=true)');
        const rawBody = req.rawBody || req.body;
        const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString() : JSON.stringify(rawBody);
        event = JSON.parse(bodyString);
      } else {
        // Production path - validate signature
        if (!signature) {
          throw new BadRequestException('Missing Stripe signature');
        }

        event = this.stripeService.constructEventFromPayload(
          req.rawBody || req.body,
          signature,
          webhookSecret || ''
        );
      }

      this.logger.log(`Processing webhook: ${event.type} (${event.id})`);

      // Check for duplicate webhook first (upsert pattern)
      const isDuplicate = await this.paymentsService.recordWebhookEvent(event);
      
      if (isDuplicate) {
        this.logger.log(`Duplicate webhook ignored: ${event.id}`);
        return { received: true, duplicate: true };
      }

      // Extract org ID from event metadata 
      let orgId: string | undefined;
      
      if (event.data?.object?.metadata?.organization_id) {
        orgId = event.data.object.metadata.organization_id;
      } else if (event.data?.object?.metadata?.orgId) {
        orgId = event.data.object.metadata.orgId;
      }

      if (!orgId) {
        throw new BadRequestException('Organization ID not found in webhook metadata');
      }

      await this.paymentsService.processWebhook(orgId, event);

      return { received: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed: ${message}`);
      
      // Dead letter pattern - store failed webhook for retry
      if (event?.id) {
        try {
          await this.paymentsService.recordWebhookFailure(event, message, error instanceof Error ? error.stack : undefined);
          this.logger.log(`Webhook failure recorded for retry: ${event.id}`);
        } catch (deadLetterError) {
          this.logger.error(`Failed to record webhook failure: ${deadLetterError}`);
        }
      }
      
      throw new BadRequestException(`Webhook error: ${message}`);
    }
  }

  @Post('webhook/retry/:id')
  async retryWebhook(@Param('id') failureId: string) {
    return this.paymentsService.retryWebhookFailure(failureId);
  }
}