import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhookController } from './webhook.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from '../../common/stripe.service';
import { DatabaseService } from '../../common/database.service';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [PaymentsController, WebhookController],
  providers: [PaymentsService, StripeService, DatabaseService, AuditService],
  exports: [PaymentsService],
})
export class PaymentsModule {}