import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateWorkOrderSimpleDto } from './create-work-order-simple.dto';

describe('CreateWorkOrderSimpleDto', () => {
  it('should validate valid DTO', async () => {
    const dto = plainToClass(CreateWorkOrderSimpleDto, {
      unitId: '12345678-1234-5678-9abc-123456789abc',
      description: 'Leaky faucet in kitchen'
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate DTO with optional tenantPhotoUrl', async () => {
    const dto = plainToClass(CreateWorkOrderSimpleDto, {
      unitId: '12345678-1234-5678-9abc-123456789abc',
      description: 'Leaky faucet in kitchen',
      tenantPhotoUrl: 'https://example.com/photo.jpg'
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid unitId', async () => {
    const dto = plainToClass(CreateWorkOrderSimpleDto, {
      unitId: 'not-a-uuid',
      description: 'Leaky faucet in kitchen'
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('unitId');
    expect(errors[0].constraints?.isUuid).toContain('must be a valid UUID');
  });

  it('should reject empty description', async () => {
    const dto = plainToClass(CreateWorkOrderSimpleDto, {
      unitId: '12345678-1234-5678-9abc-123456789abc',
      description: ''
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('description');
  });

  it('should reject description that is too long', async () => {
    const dto = plainToClass(CreateWorkOrderSimpleDto, {
      unitId: '12345678-1234-5678-9abc-123456789abc',
      description: 'x'.repeat(1001) // 1001 characters
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('description');
    expect(errors[0].constraints?.length).toContain('between 1 and 1000 characters');
  });

  it('should reject invalid tenantPhotoUrl', async () => {
    const dto = plainToClass(CreateWorkOrderSimpleDto, {
      unitId: '12345678-1234-5678-9abc-123456789abc',
      description: 'Leaky faucet in kitchen',
      tenantPhotoUrl: 'not-a-url'
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('tenantPhotoUrl');
    expect(errors[0].constraints?.isUrl).toContain('must be a valid URL');
  });
});