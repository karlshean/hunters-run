import { IsUUID, IsString, IsOptional, IsUrl, Length } from 'class-validator';

export class CreateWorkOrderDto {
  @IsUUID('all', { message: 'unitId must be a valid UUID' })
  unitId: string;

  @IsString()
  @Length(1, 1000, { message: 'description must be between 1 and 1000 characters' })
  description: string;

  @IsOptional()
  @IsUrl({}, { message: 'tenantPhotoUrl must be a valid URL' })
  tenantPhotoUrl?: string;
}