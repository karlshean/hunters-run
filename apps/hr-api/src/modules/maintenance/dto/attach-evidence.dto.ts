import { IsString, IsNotEmpty } from 'class-validator';

export class AttachEvidenceDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  sha256: string; // hex string

  @IsString()
  @IsNotEmpty()
  mime: string;

  @IsString()
  takenAt: string; // ISO timestamp
}