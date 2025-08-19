import { IsUUID, IsOptional, IsInt, Min, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID(4, { message: 'tenantId must be a valid UUID' })
  tenantId: string;

  @IsOptional()
  @IsInt({ message: 'amountCents must be an integer' })
  @Min(1, { message: 'amountCents must be at least 1 cent' })
  amountCents?: number;

  @IsOptional()
  @IsUUID(4, { message: 'chargeId must be a valid UUID' })
  chargeId?: string;

  @IsOptional()
  @IsString()
  currency?: string = 'usd';
}