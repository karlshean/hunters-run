import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AuditEvent } from './audit.service';
import { DatabaseService } from './database.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockClient: any;

  beforeEach(async () => {
    mockClient = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      executeWithOrgContext: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should log an audit event successfully', async () => {
      const mockAuditId = '12345678-1234-5678-9abc-123456789abc';
      const auditEvent: AuditEvent = {
        orgId: 'org-123',
        action: 'work_order.created',
        entity: 'work_order',
        entityId: 'wo-456',
        actorId: 'user-789',
        metadata: { title: 'Test Work Order', priority: 'high' }
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: mockAuditId }]
      });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.log(auditEvent);

      expect(result).toBe(mockAuditId);
      expect(mockDatabaseService.executeWithOrgContext).toHaveBeenCalledWith(
        auditEvent.orgId,
        expect.any(Function)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT hr.create_audit_log_entry'),
        [
          auditEvent.orgId,
          auditEvent.action,
          auditEvent.entity,
          auditEvent.entityId,
          auditEvent.actorId,
          JSON.stringify(auditEvent.metadata)
        ]
      );
    });

    it('should handle missing optional fields', async () => {
      const mockAuditId = 'audit-id-123';
      const auditEvent: AuditEvent = {
        orgId: 'org-123',
        action: 'payment.received',
        entity: 'payment',
        entityId: 'pay-456'
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: mockAuditId }]
      });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.log(auditEvent);

      expect(result).toBe(mockAuditId);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT hr.create_audit_log_entry'),
        [
          auditEvent.orgId,
          auditEvent.action,
          auditEvent.entity,
          auditEvent.entityId,
          null, // actorId
          JSON.stringify({}) // empty metadata
        ]
      );
    });

    it('should propagate database errors', async () => {
      const auditEvent: AuditEvent = {
        orgId: 'org-123',
        action: 'test.action',
        entity: 'work_order',
        entityId: 'test-id'
      };

      const dbError = new Error('Database connection failed');
      mockClient.query.mockRejectedValueOnce(dbError);

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      await expect(service.log(auditEvent)).rejects.toThrow('Database connection failed');
    });
  });

  describe('verifyChains', () => {
    it('should return valid for empty audit log', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.verifyChains('org-123');

      expect(result).toEqual({
        valid: true,
        totalEvents: 0
      });
    });

    it('should verify a valid single-event chain', async () => {
      const orgId = 'org-123';
      const entityId = 'wo-456';
      const createdAt = '2023-01-01T00:00:00Z';
      
      // Create a proper hash for the event
      const crypto = require('crypto');
      const payload = JSON.stringify({
        org_id: orgId,
        actor_id: 'user-789',
        action: 'work_order.created',
        entity: 'work_order',
        entity_id: entityId,
        metadata: { title: 'Test' },
        created_at: createdAt
      });
      const expectedHash = crypto.createHash('sha256').update(':' + payload).digest();

      const mockAuditEvent = {
        id: 'audit-1',
        entity: 'work_order',
        entity_id: entityId,
        prev_hash: null,
        hash: expectedHash,
        created_at: createdAt,
        org_id: orgId,
        actor_id: 'user-789',
        action: 'work_order.created',
        metadata: { title: 'Test' }
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockAuditEvent]
      });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.verifyChains(orgId);

      expect(result.valid).toBe(true);
      expect(result.totalEvents).toBe(1);
    });

    it('should detect hash chain break', async () => {
      const orgId = 'org-123';
      const entityId = 'wo-456';
      
      const mockAuditEvents = [
        {
          id: 'audit-1',
          entity: 'work_order',
          entity_id: entityId,
          prev_hash: null,
          hash: Buffer.from('validhash1', 'hex'),
          created_at: '2023-01-01T00:00:00Z',
          org_id: orgId,
          actor_id: 'user-789',
          action: 'work_order.created',
          metadata: {}
        },
        {
          id: 'audit-2',
          entity: 'work_order',
          entity_id: entityId,
          prev_hash: Buffer.from('wronghash', 'hex'), // Should be 'validhash1'
          hash: Buffer.from('validhash2', 'hex'),
          created_at: '2023-01-01T01:00:00Z',
          org_id: orgId,
          actor_id: 'user-789',
          action: 'work_order.status_updated',
          metadata: {}
        }
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockAuditEvents
      });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.verifyChains(orgId);

      expect(result.valid).toBe(false);
      expect(result.totalEvents).toBe(2);
      expect(result.firstBadEvent).toEqual({
        id: 'audit-2',
        entity: 'work_order',
        entityId: entityId,
        expectedHash: 'validhash1',
        actualHash: 'wronghash'
      });
    });

    it('should detect first event with non-null prev_hash', async () => {
      const orgId = 'org-123';
      const entityId = 'wo-456';
      
      const mockAuditEvent = {
        id: 'audit-1',
        entity: 'work_order',
        entity_id: entityId,
        prev_hash: Buffer.from('shouldbenull', 'hex'), // Should be null for first event
        hash: Buffer.from('hash1', 'hex'),
        created_at: '2023-01-01T00:00:00Z',
        org_id: orgId,
        actor_id: 'user-789',
        action: 'work_order.created',
        metadata: {}
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockAuditEvent]
      });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.verifyChains(orgId);

      expect(result.valid).toBe(false);
      expect(result.totalEvents).toBe(1);
      expect(result.firstBadEvent).toEqual({
        id: 'audit-1',
        entity: 'work_order',
        entityId: entityId,
        expectedHash: 'null',
        actualHash: 'shouldbenull'
      });
    });
  });

  describe('getEntityAuditTrail', () => {
    it('should return audit trail for entity', async () => {
      const orgId = 'org-123';
      const entity = 'work_order';
      const entityId = 'wo-456';

      const mockAuditTrail = [
        {
          id: 'audit-1',
          action: 'work_order.created',
          actor_id: 'user-789',
          metadata: { title: 'Test Work Order' },
          created_at: '2023-01-01T00:00:00Z',
          prev_hash_hex: null,
          hash_hex: 'hash1'
        },
        {
          id: 'audit-2',
          action: 'work_order.status_updated',
          actor_id: 'user-789',
          metadata: { fromStatus: 'new', toStatus: 'assigned' },
          created_at: '2023-01-01T01:00:00Z',
          prev_hash_hex: 'hash1',
          hash_hex: 'hash2'
        }
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockAuditTrail
      });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.getEntityAuditTrail(orgId, entity, entityId);

      expect(result).toEqual(mockAuditTrail);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, action, actor_id, metadata, created_at'),
        [orgId, entity, entityId]
      );
    });

    it('should return empty array for entity with no audit trail', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      mockDatabaseService.executeWithOrgContext.mockImplementation(
        async (orgId: string, callback: (client: any) => Promise<any>) => {
          return callback(mockClient);
        }
      );

      const result = await service.getEntityAuditTrail('org-123', 'work_order', 'nonexistent');

      expect(result).toEqual([]);
    });
  });
});