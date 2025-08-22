import { IsUUID, IsString, IsOptional, IsUrl, Length, IsObject, ValidateNested, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class PhotoMetadataDto {
  @IsString()
  s3Key: string;

  @IsOptional()
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  sizeBytes?: number;
}

export class CreateWorkOrderDto {
  @IsUUID('all', { message: 'unitId must be a valid UUID' })
  unitId: string;

  @IsString()
  @Length(1, 1000, { message: 'description must be between 1 and 1000 characters' })
  description: string;

  @IsOptional()
  @IsUrl({}, { message: 'tenantPhotoUrl must be a valid URL' })
  tenantPhotoUrl?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PhotoMetadataDto)
  photoMetadata?: PhotoMetadataDto;
}