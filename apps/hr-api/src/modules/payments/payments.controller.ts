import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseInterceptors,
  ValidationPipe,
  UsePipes,
  RawBodyRequest,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { StripeService } from '../../common/stripe.service';
import { RLSInterceptor } from '../../common/rls.interceptor';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
@UseInterceptors(RLSInterceptor)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly config: ConfigService
  ) {}

  @Post('checkout')
  async createCheckout(@Req() req: any, @Body() dto: CreateCheckoutDto) {
    return this.paymentsService.createCheckout(req.orgId, dto);
  }

  @Post('webhook')
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    try {
      // Validate webhook signature and parse event
      const event = this.stripeService.constructEventFromPayload(
        req.rawBody || req.body,
        signature,
        webhookSecret || ''
      );

      this.logger.log(`Processing webhook: ${event.type} (${event.id})`);

      // Extract org ID from event metadata or header
      let orgId: string | undefined;
      
      if (event.data?.object?.metadata?.orgId) {
        orgId = event.data.object.metadata.orgId;
      } else {
        orgId = req.headers['x-org-id'] as string;
      }

      if (!orgId) {
        throw new BadRequestException('Organization ID not found in webhook metadata or header');
      }

      await this.paymentsService.processWebhook(orgId, event);

      return { received: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed: ${message}`);
      throw new BadRequestException(`Webhook error: ${message}`);
    }
  }

  @Get('charges/:id')
  async getCharge(@Req() req: any, @Param('id') id: string) {
    return this.paymentsService.getCharge(req.orgId, id);
  }
}