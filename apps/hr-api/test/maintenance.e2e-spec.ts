import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Maintenance API (e2e)', () => {
  let app: INestApplication;
  const orgId = '00000000-0000-0000-0000-000000000001';
  const invalidOrgId = '99999999-9999-9999-9999-999999999999';
  let workOrderId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('should return 403 when x-org-id header is missing', () => {
      return request(app.getHttpServer())
        .get('/api/lookups/units')
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toContain('x-org-id header is required');
        });
    });

    it('should return 403 when x-org-id format is invalid', () => {
      return request(app.getHttpServer())
        .get('/api/lookups/units')
        .set('x-org-id', 'invalid-uuid')
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid organization ID format');
        });
    });

    it('should return empty arrays for unknown org', () => {
      return request(app.getHttpServer())
        .get('/api/lookups/units')
        .set('x-org-id', invalidOrgId)
        .expect(200)
        .expect([]);
    });
  });

  describe('Lookup Endpoints', () => {
    it('should return units for valid org', () => {
      return request(app.getHttpServer())
        .get('/api/lookups/units')
        .set('x-org-id', orgId)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('propertyId');
            expect(res.body[0]).toHaveProperty('unitNumber');
          }
        });
    });

    it('should return tenants for valid org', () => {
      return request(app.getHttpServer())
        .get('/api/lookups/tenants')
        .set('x-org-id', orgId)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return technicians for valid org', () => {
      return request(app.getHttpServer())
        .get('/api/lookups/technicians')
        .set('x-org-id', orgId)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return properties for valid org', () => {
      return request(app.getHttpServer())
        .get('/api/lookups/properties')
        .set('x-org-id', orgId)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Work Order Creation', () => {
    it('should create work order with valid payload', async () => {
      const createDto = {
        unitId: '20000000-0000-0000-0000-000000000001',
        tenantId: '30000000-0000-0000-0000-000000000001',
        title: 'Test work order',
        description: 'Test description',
        priority: 'high'
      };

      const response = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', orgId)
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(createDto.title);
      expect(response.body.priority).toBe(createDto.priority);
      expect(response.body.status).toBe('new');
      
      workOrderId = response.body.id;
    });

    it('should return 400 for invalid payload', () => {
      const invalidDto = {
        unitId: 'invalid-uuid',
        tenantId: '30000000-0000-0000-0000-000000000001',
        title: '',
        priority: 'invalid-priority'
      };

      return request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', orgId)
        .send(invalidDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(expect.arrayContaining([
            expect.stringContaining('unitId must be a valid UUID'),
            expect.stringContaining('title should not be empty'),
            expect.stringContaining('priority must be low, normal, or high')
          ]));
        });
    });

    it('should return 404 for non-existent unit', () => {
      const createDto = {
        unitId: '99999999-9999-9999-9999-999999999999',
        tenantId: '30000000-0000-0000-0000-000000000001',
        title: 'Test work order',
        priority: 'normal'
      };

      return request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', orgId)
        .send(createDto)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Unit not found');
        });
    });
  });

  describe('Work Order Status Transitions', () => {
    beforeEach(async () => {
      // Create a work order for status transition tests
      const createDto = {
        unitId: '20000000-0000-0000-0000-000000000001',
        tenantId: '30000000-0000-0000-0000-000000000001',
        title: 'Status transition test',
        priority: 'normal'
      };

      const response = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', orgId)
        .send(createDto);

      workOrderId = response.body.id;
    });

    it('should allow valid status transition', async () => {
      // new -> triaged
      const response = await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', orgId)
        .send({ toStatus: 'triaged' })
        .expect(200);

      expect(response.body.status).toBe('triaged');
    });

    it('should return 422 for invalid status transition', () => {
      // new -> completed (invalid)
      return request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', orgId)
        .send({ toStatus: 'completed' })
        .expect(422)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid status transition');
          expect(res.body.message).toContain('from \'new\' to \'completed\'');
        });
    });

    it('should return 404 for non-existent work order', () => {
      return request(app.getHttpServer())
        .patch('/api/maintenance/work-orders/99999999-9999-9999-9999-999999999999/status')
        .set('x-org-id', orgId)
        .send({ toStatus: 'triaged' })
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Work order not found');
        });
    });
  });

  describe('Audit Validation', () => {
    beforeEach(async () => {
      // Create a work order and perform some transitions
      const createDto = {
        unitId: '20000000-0000-0000-0000-000000000001',
        tenantId: '30000000-0000-0000-0000-000000000001',
        title: 'Audit test work order',
        priority: 'high'
      };

      const response = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', orgId)
        .send(createDto);

      workOrderId = response.body.id;

      // Perform a status transition to create audit events
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', orgId)
        .send({ toStatus: 'triaged' });
    });

    it('should validate audit chain successfully', () => {
      return request(app.getHttpServer())
        .get(`/api/maintenance/work-orders/${workOrderId}/audit/validate`)
        .set('x-org-id', orgId)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('valid');
          expect(res.body).toHaveProperty('eventsCount');
          expect(res.body).toHaveProperty('headHash');
          expect(res.body.valid).toBe(true);
          expect(res.body.eventsCount).toBeGreaterThan(0);
        });
    });
  });

  describe('Happy Path Flow', () => {
    it('should complete full work order lifecycle', async () => {
      // 1. Create work order
      const createDto = {
        unitId: '20000000-0000-0000-0000-000000000001',
        tenantId: '30000000-0000-0000-0000-000000000001',
        title: 'Full lifecycle test',
        priority: 'normal'
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', orgId)
        .send(createDto)
        .expect(201);

      workOrderId = createResponse.body.id;

      // 2. Transition through statuses
      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', orgId)
        .send({ toStatus: 'triaged' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', orgId)
        .send({ toStatus: 'assigned' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', orgId)
        .send({ toStatus: 'in_progress' })
        .expect(200);

      const completedResponse = await request(app.getHttpServer())
        .patch(`/api/maintenance/work-orders/${workOrderId}/status`)
        .set('x-org-id', orgId)
        .send({ toStatus: 'completed' })
        .expect(200);

      expect(completedResponse.body.status).toBe('completed');

      // 3. Validate audit chain
      const auditResponse = await request(app.getHttpServer())
        .get(`/api/maintenance/work-orders/${workOrderId}/audit/validate`)
        .set('x-org-id', orgId)
        .expect(200);

      expect(auditResponse.body.valid).toBe(true);
      expect(auditResponse.body.eventsCount).toBeGreaterThanOrEqual(5); // create + 4 status changes
    });
  });
});