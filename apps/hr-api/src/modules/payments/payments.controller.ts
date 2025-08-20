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
  Logger,
  SetMetadata
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


  @Get('charges/:id')
  async getCharge(@Req() req: any, @Param('id') id: string) {
    return this.paymentsService.getCharge(req.orgId, id);
  }
}