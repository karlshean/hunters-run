import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { DatabaseService } from '../../common/database.service';
import { AuditService } from '../../common/audit.service';
import { FilesService } from '../files/files.service';
import { CreateWorkOrderSimpleDto } from './dto/create-work-order-simple.dto';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockFilesService: jest.Mocked<FilesService>;
  let mockClient: any;

  beforeEach(async () => {
    mockClient = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      executeWithOrgContext: jest.fn(),
    } as any;

    mockAuditService = {
      log: jest.fn(),
    } as any;

    mockFilesService = {
      validatePhotoToken: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSimpleWorkOrder', () => {
    it('should create work order for demo org', async () => {
      const orgId = '00000000-0000-4000-8000-000000000001';
      const dto: CreateWorkOrderSimpleDto = {
        unitId: '12345678-1234-5678-9abc-123456789abc',
        description: 'Leaky faucet in kitchen'
      };

      const result = await service.createSimpleWorkOrder(orgId, dto);

      expect(result).toMatchObject({
        unitId: dto.unitId,
        status: 'open',
        ticketId: expect.stringMatching(/^WO-\d{4}-\d{4}$/)
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should create work order with photo URL for demo org', async () => {
      const orgId = '00000000-0000-4000-8000-000000000001';
      const dto: CreateWorkOrderSimpleDto = {
        unitId: '12345678-1234-5678-9abc-123456789abc',
        description: 'Leaky faucet in kitchen',
        tenantPhotoUrl: 'https://example.com/photo.jpg'
      };

      const result = await service.createSimpleWorkOrder(orgId, dto);

      expect(result).toMatchObject({
        unitId: dto.unitId,
        status: 'open',
        tenantPhotoUrl: dto.tenantPhotoUrl,
        ticketId: expect.stringMatching(/^WO-\d{4}-\d{4}$/)
      });
    });

    it('should create work order with database for non-demo org', async () => {
      const orgId = 'real-org-id';
      const dto: CreateWorkOrderSimpleDto = {
        unitId: '12345678-1234-5678-9abc-123456789abc',
        description: 'Leaky faucet in kitchen'
      };

      const mockWorkOrder = {
        id: 'wo-123',
        unitId: dto.unitId,
        status: 'open',
        createdAt: '2023-01-01T00:00:00.000Z',
        tenantPhotoUrl: null
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: dto.unitId }] }) // unit check
        .mockResolvedValueOnce({ rows: [mockWorkOrder] }); // insert

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      mockAuditService.log.mockResolvedValue('audit-id');

      const result = await service.createSimpleWorkOrder(orgId, dto);

      expect(result).toMatchObject({
        ...mockWorkOrder,
        ticketId: expect.stringMatching(/^WO-\d{4}-\d{4}$/)
      });

      expect(mockDatabaseService.executeWithOrgContext).toHaveBeenCalledWith(
        orgId,
        expect.any(Function)
      );

      expect(mockAuditService.log).toHaveBeenCalledWith({
        orgId,
        action: 'work_order.created',
        entity: 'work_order',
        entityId: mockWorkOrder.id,
        metadata: {
          description: dto.description,
          status: 'open',
          unitId: dto.unitId,
          photo_attached: false
        }
      });
    });

    it('should throw NotFoundException for invalid unit', async () => {
      const orgId = 'real-org-id';
      const dto: CreateWorkOrderSimpleDto = {
        unitId: '12345678-1234-5678-9abc-123456789abc',
        description: 'Leaky faucet in kitchen'
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] }); // unit not found

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      await expect(service.createSimpleWorkOrder(orgId, dto))
        .rejects.toThrow('Unit not found');
    });
  });
});