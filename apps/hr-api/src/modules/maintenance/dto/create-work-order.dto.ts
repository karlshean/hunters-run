import { IsUUID, IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreateWorkOrderDto {
  @IsUUID('4', { message: 'unitId must be a valid UUID' })
  unitId: string;

  @IsUUID('4', { message: 'tenantId must be a valid UUID' })
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['low', 'normal', 'high'], { message: 'priority must be low, normal, or high' })
  priority: 'low' | 'normal' | 'high';

  @IsString()
  @IsOptional()
  photoKey?: string;
}