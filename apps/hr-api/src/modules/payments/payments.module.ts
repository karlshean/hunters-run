import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from '../../common/stripe.service';
import { DatabaseService } from '../../common/database.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, DatabaseService],
  exports: [PaymentsService],
})
export class PaymentsModule {}