import { IsUUID, IsString, IsNotEmpty, IsOptional, IsUrl, Length } from 'class-validator';

export class CreateWorkOrderSimpleDto {
  @IsUUID('4', { message: 'unitId must be a valid UUID' })
  unitId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 1000, { message: 'description must be between 1 and 1000 characters' })
  description: string;

  @IsOptional()
  @IsUrl({}, { message: 'tenantPhotoUrl must be a valid URL' })
  tenantPhotoUrl?: string;
}