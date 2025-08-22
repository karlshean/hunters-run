import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { LookupsService } from '../lookups/lookups.service';
import { BadRequestException } from '@nestjs/common';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';

describe('MaintenanceController', () => {
  let controller: MaintenanceController;
  let service: MaintenanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [
        {
          provide: MaintenanceService,
          useValue: {
            createWorkOrder: jest.fn(),
          },
        },
        {
          provide: LookupsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<MaintenanceController>(MaintenanceController);
    service = module.get<MaintenanceService>(MaintenanceService);
  });

  describe('createWorkOrder', () => {
    it('should throw BadRequestException if orgId is missing', async () => {
      const dto: CreateWorkOrderDto = {
        unitId: '11111111-1111-1111-1111-111111111111',
        description: 'Test description',
      };

      const req = { orgId: null };

      await expect(controller.createWorkOrder(req, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should call service with correct parameters when orgId is present', async () => {
      const dto: CreateWorkOrderDto = {
        unitId: '11111111-1111-1111-1111-111111111111',
        description: 'Test description',
      };

      const req = { orgId: '00000000-0000-4000-8000-000000000001' };
      const expectedResult = {
        id: 'test-id',
        ticketId: 'WO-2025-0001',
        unitId: dto.unitId,
        status: 'open',
        createdAt: new Date().toISOString(),
      };

      jest.spyOn(service, 'createWorkOrder').mockResolvedValue(expectedResult);

      const result = await controller.createWorkOrder(req, dto);

      expect(service.createWorkOrder).toHaveBeenCalledWith(req.orgId, dto);
      expect(result).toEqual(expectedResult);
    });

    it('should return work order with ticketId format WO-YYYY-####', async () => {
      const dto: CreateWorkOrderDto = {
        unitId: '11111111-1111-1111-1111-111111111111',
        description: 'Test description',
      };

      const req = { orgId: '00000000-0000-4000-8000-000000000001' };
      const expectedResult = {
        id: 'test-id',
        ticketId: 'WO-2025-0001',
        unitId: dto.unitId,
        status: 'open',
        createdAt: new Date().toISOString(),
      };

      jest.spyOn(service, 'createWorkOrder').mockResolvedValue(expectedResult);

      const result = await controller.createWorkOrder(req, dto);

      expect(result.ticketId).toMatch(/^WO-\d{4}-\d{4}$/);
      expect(result.status).toBe('open');
    });
  });
});