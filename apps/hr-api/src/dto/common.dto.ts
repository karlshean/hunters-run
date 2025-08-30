import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional({ 
    description: 'Page number (1-based)', 
    minimum: 1, 
    maximum: 1000, 
    default: 1 
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(1000)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Items per page', 
    minimum: 1, 
    maximum: 100, 
    default: 20 
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Sort field',
    example: 'created_at'
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ 
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'DESC'
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class StandardResponseDto<T> {
  @ApiProperty({ description: 'Operation success status' })
  success!: boolean;

  @ApiProperty({ description: 'Response data' })
  data!: T;

  @ApiProperty({ description: 'Response metadata' })
  meta!: {
    requestId: string;
    timestamp: string;
    organizationId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export class ErrorResponseDto {
  @ApiProperty({ description: 'Operation success status', example: false })
  success!: boolean;

  @ApiProperty({ description: 'Error code', example: 'AUTH-ORG-INVALID' })
  code!: string;

  @ApiProperty({ description: 'Human-readable error message' })
  message!: string;

  @ApiProperty({ description: 'Additional error details', required: false })
  details?: any;

  @ApiProperty({ description: 'Request metadata' })
  meta!: {
    requestId: string;
    timestamp: string;
  };
}

export class IdempotencyHeaders {
  @ApiProperty({
    description: 'Idempotency key for safe retries',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  'Idempotency-Key': string;
}