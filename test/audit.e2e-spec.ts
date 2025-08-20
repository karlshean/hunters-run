import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../apps/hr-api/src/app.module';
import { Client } from 'pg';

describe('Audit E2E Tests', () => {
  let app: INestApplication;
  let dbClient: Client;
  const testOrgId = '11111111-1111-1111-1111-111111111111';
  const testWorkOrderId = 'wo-e2e-test-' + Date.now();

  beforeAll(async () => {
    // Set up database connection
    const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
    dbClient = new Client({ connectionString });
    
    try {
      await dbClient.connect();
      
      // Set up test context
      await dbClient.query(`SET app.current_org = '${testOrgId}'`);
      
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    } catch (error) {
      console.error('Failed to setup test environment:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await dbClient.query('DELETE FROM hr.audit_log WHERE org_id = $1', [testOrgId]);
      await dbClient.query('DELETE FROM hr.work_orders WHERE organization_id = $1', [testOrgId]);
      await dbClient.end();
      await app.close();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  beforeEach(async () => {
    // Clean up audit log before each test
    await dbClient.query('DELETE FROM hr.audit_log WHERE org_id = $1', [testOrgId]);
    await dbClient.query('DELETE FROM hr.work_orders WHERE organization_id = $1', [testOrgId]);
  });

  describe('/api/audit/verify (GET)', () => {
    it('should return valid verification for empty audit log', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('x-org-id', testOrgId)
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        totalEvents: 0
      });
    });

    it('should verify audit chain after work order operations', async () => {
      // Create a work order (this should create audit events)
      const createResponse = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', testOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'E2E Test Work Order',
          description: 'Created for audit testing',
          priority: 'high'
        })
        .expect(201);

      const workOrderId = createResponse.body.id;

      // Update work order status (should create more audit events)
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', testOrgId)
        .send({
          toStatus: 'triaged',
          note: 'E2E test status update'
        })
        .expect(200);

      // Verify the audit chain
      const verifyResponse = await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('x-org-id', testOrgId)
        .expect(200);

      expect(verifyResponse.body.valid).toBe(true);
      expect(verifyResponse.body.totalEvents).toBeGreaterThan(0);
      expect(verifyResponse.body.firstBadEvent).toBeUndefined();
    });

    it('should require organization context', async () => {
      await request(app.getHttpServer())
        .get('/api/audit/verify')
        // Missing x-org-id header
        .expect(400);
    });
  });

  describe('/api/audit/entity/:entity/:entityId (GET)', () => {
    it('should return audit trail for work order', async () => {
      // Create a work order
      const createResponse = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', testOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'Audit Trail Test Work Order',
          description: 'For testing audit trail',
          priority: 'normal'
        })
        .expect(201);

      const workOrderId = createResponse.body.id;

      // Perform additional operations to create audit trail
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', testOrgId)
        .send({
          toStatus: 'triaged',
          note: 'Triaged for testing'
        })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/maintenance/work-orders/${workOrderId}/assign`)
        .set('x-org-id', testOrgId)
        .send({
          technicianId: '00000000-0000-4000-8000-000000000005'
        })
        .expect(200);

      // Get the audit trail
      const auditResponse = await request(app.getHttpServer())
        .get(`/api/audit/entity/work_order/${workOrderId}`)
        .set('x-org-id', testOrgId)
        .expect(200);

      expect(Array.isArray(auditResponse.body)).toBe(true);
      expect(auditResponse.body.length).toBeGreaterThan(0);

      // Verify the structure of audit events
      const auditEvents = auditResponse.body;
      auditEvents.forEach(event => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('action');
        expect(event).toHaveProperty('metadata');
        expect(event).toHaveProperty('created_at');
        expect(event).toHaveProperty('hash_hex');
      });

      // Verify we have the expected audit actions
      const actions = auditEvents.map(e => e.action);
      expect(actions).toContain('work_order.created');
      expect(actions).toContain('work_order.status_updated');
      expect(actions).toContain('work_order.assigned');
    });

    it('should return empty array for non-existent entity', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/audit/entity/work_order/non-existent-id')
        .set('x-org-id', testOrgId)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should enforce organization isolation', async () => {
      const otherOrgId = '22222222-2222-2222-2222-222222222222';

      // Create work order in test org
      const createResponse = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', testOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'Isolation Test Work Order',
          priority: 'normal'
        })
        .expect(201);

      const workOrderId = createResponse.body.id;

      // Try to access audit trail from different org
      const auditResponse = await request(app.getHttpServer())
        .get(`/api/audit/entity/work_order/${workOrderId}`)
        .set('x-org-id', otherOrgId)
        .expect(200);

      // Should return empty because of RLS isolation
      expect(auditResponse.body).toEqual([]);
    });
  });

  describe('Audit Integration with Business Operations', () => {
    it('should create audit trail for complete work order lifecycle', async () => {
      // 1. Create work order
      const createResponse = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', testOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'Complete Lifecycle Test',
          description: 'Testing complete audit trail',
          priority: 'high'
        })
        .expect(201);

      const workOrderId = createResponse.body.id;

      // 2. Triage work order
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', testOrgId)
        .send({ toStatus: 'triaged', note: 'Initial triage' })
        .expect(200);

      // 3. Assign technician
      await request(app.getHttpServer())
        .post(`/api/maintenance/work-orders/${workOrderId}/assign`)
        .set('x-org-id', testOrgId)
        .send({ technicianId: '00000000-0000-4000-8000-000000000005' })
        .expect(200);

      // 4. Update to assigned status
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', testOrgId)
        .send({ toStatus: 'assigned' })
        .expect(200);

      // 5. Start work
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', testOrgId)
        .send({ toStatus: 'in_progress' })
        .expect(200);

      // 6. Attach evidence
      await request(app.getHttpServer())
        .post(`/api/maintenance/work-orders/${workOrderId}/evidence`)
        .set('x-org-id', testOrgId)
        .send({
          key: 'evidence/test-photo.jpg',
          mime: 'image/jpeg',
          sha256: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
          takenAt: new Date().toISOString()
        })
        .expect(201);

      // 7. Complete work
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', testOrgId)
        .send({ toStatus: 'completed' })
        .expect(200);

      // Verify the complete audit trail
      const auditResponse = await request(app.getHttpServer())
        .get(`/api/audit/entity/work_order/${workOrderId}`)
        .set('x-org-id', testOrgId)
        .expect(200);

      const auditEvents = auditResponse.body;
      const actions = auditEvents.map(e => e.action);

      expect(actions).toContain('work_order.created');
      expect(actions).toContain('work_order.status_updated');
      expect(actions).toContain('work_order.assigned');
      expect(actions.filter(a => a === 'work_order.status_updated')).toHaveLength(4); // triaged, assigned, in_progress, completed

      // Verify chain integrity
      const verifyResponse = await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('x-org-id', testOrgId)
        .expect(200);

      expect(verifyResponse.body.valid).toBe(true);
      expect(verifyResponse.body.totalEvents).toBeGreaterThanOrEqual(auditEvents.length);
    });

    it('should create audit trail for payment operations', async () => {
      // Create payment checkout
      const checkoutResponse = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('x-org-id', testOrgId)
        .send({
          tenantId: '00000000-0000-4000-8000-000000000004',
          amountCents: 10000,
          currency: 'usd'
        })
        .expect(201);

      expect(checkoutResponse.body).toHaveProperty('url');
      expect(checkoutResponse.body).toHaveProperty('sessionId');

      // Verify audit chain after payment operations
      const verifyResponse = await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('x-org-id', testOrgId)
        .expect(200);

      expect(verifyResponse.body.valid).toBe(true);
      expect(verifyResponse.body.totalEvents).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing org-id header gracefully', async () => {
      await request(app.getHttpServer())
        .get('/api/audit/verify')
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/audit/entity/work_order/test-id')
        .expect(400);
    });

    it('should handle invalid entity types', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/audit/entity/invalid_entity/test-id')
        .set('x-org-id', testOrgId)
        .expect(200);

      // Should return empty array for unknown entity types
      expect(response.body).toEqual([]);
    });

    it('should handle malformed UUIDs in paths', async () => {
      await request(app.getHttpServer())
        .get('/api/audit/entity/work_order/not-a-uuid')
        .set('x-org-id', testOrgId)
        .expect(200); // Should not crash, returns empty array

      await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('x-org-id', 'not-a-uuid')
        .expect(400); // Should validate org ID format
    });
  });
});