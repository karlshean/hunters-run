import { IsUUID, IsString, IsNotEmpty, IsEnum, IsOptional, ValidateNested, IsObject, IsIn, Max, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class PhotoMetadataDto {
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsDateString()
  @IsOptional()
  uploadedAt?: string;

  @IsNumber()
  @IsOptional()
  @Max(5 * 1024 * 1024, { message: 'Photo size cannot exceed 5MB' })
  sizeBytes?: number;

  @IsString()
  @IsOptional()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'], { message: 'Only JPEG, PNG, and WebP images are supported' })
  mimeType?: string;
}

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

  @IsObject()
  @ValidateNested()
  @Type(() => PhotoMetadataDto)
  @IsOptional()
  photoMetadata?: PhotoMetadataDto;
}