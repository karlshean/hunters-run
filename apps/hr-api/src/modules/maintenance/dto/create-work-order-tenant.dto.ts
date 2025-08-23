import { IsUUID, IsString, IsNotEmpty, IsOptional, Length, IsIn, IsPhoneNumber, Matches } from 'class-validator';

export class CreateWorkOrderTenantDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255, { message: 'title must be between 1 and 255 characters' })
  title: string;

  @IsString()
  @Length(0, 1000, { message: 'description must be between 0 and 1000 characters' })
  description: string;

  @IsString()
  @IsIn(['low', 'normal', 'high', 'urgent', 'emergency'], { 
    message: 'priority must be one of: low, normal, high, urgent, emergency' 
  })
  priority: string;

  @IsUUID('all', { message: 'unit_id must be a valid UUID' })
  unit_id: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255, { message: 'tenant_name must be between 1 and 255 characters' })
  tenant_name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, { 
    message: 'tenant_phone must be a valid E.164 phone number' 
  })
  tenant_phone: string;

  @IsOptional()
  @IsString()
  tenant_photo_s3_key?: string;

  @IsOptional()
  @IsString()
  tenant_photo_filename?: string;
}