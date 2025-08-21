import { IsString, IsNumber, IsIn, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export const ALLOWED_MIME_TYPES = ['image/jpeg','image/png','image/webp'] as const;
export type AllowedMime = typeof ALLOWED_MIME_TYPES[number];

export class PresignPhotoDto {
  @IsString() @IsNotEmpty()
  fileName!: string;

  @IsString() @IsIn(ALLOWED_MIME_TYPES)
  mimeType!: AllowedMime;

  @Type(() => Number)
  @IsNumber() @Min(1) @Max(5 * 1024 * 1024)
  fileSize!: number;
}