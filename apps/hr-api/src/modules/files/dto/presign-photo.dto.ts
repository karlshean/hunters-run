import { IsString, IsNotEmpty, IsNumber, Max, Min, IsIn } from 'class-validator';

export class PresignPhotoDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsNumber()
  @Min(1, { message: 'File size must be at least 1 byte' })
  @Max(5 * 1024 * 1024, { message: 'File size cannot exceed 5MB' })
  fileSize: number;

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'], { 
    message: 'Only JPEG, PNG, and WebP images are supported' 
  })
  mimeType: string;
}