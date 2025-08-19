import { IsUUID } from 'class-validator';

export class AssignTechnicianDto {
  @IsUUID('4', { message: 'technicianId must be a valid UUID' })
  technicianId: string;
}