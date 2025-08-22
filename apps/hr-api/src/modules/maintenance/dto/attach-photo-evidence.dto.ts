import { IsString, IsNotEmpty, IsNumber, Max, IsIn, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class PhotoMetadataDto {
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsString()
  @IsIn(['image/jpeg', 'image/png'])
  mimeType: string;

  @IsNumber()
  @Max(2_000_000)
  sizeBytes: number;
}

export class AttachPhotoEvidenceDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PhotoMetadataDto)
  photoMetadata: PhotoMetadataDto;
}