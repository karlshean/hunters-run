import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ChangeStatusDto {
  @IsEnum(['new', 'triaged', 'assigned', 'in_progress', 'completed', 'closed', 'reopened'], {
    message: 'toStatus must be one of: new, triaged, assigned, in_progress, completed, closed, reopened'
  })
  toStatus: 'new' | 'triaged' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened';

  @IsString()
  @IsOptional()
  note?: string;
}