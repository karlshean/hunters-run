import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('RLS Security (e2e)', () => {
  let app: INestApplication;
  let dbClient: Client;

  // Fixed organization IDs for testing
  const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  // Test data IDs
  const PROPERTY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
  const PROPERTY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc';
  const UNIT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad';
  const UNIT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd';
  const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae';
  const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbe';
  const TECH_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa0f';
  const TECH_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb0f';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup database connection
    const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
    dbClient = new Client({ connectionString });
    
    try {
      await dbClient.connect();
      await seedTestData();
    } catch (error) {
      console.warn('Database connection failed for RLS e2e tests:', (error as Error).message);
      console.warn('Skipping RLS e2e tests - ensure PostgreSQL is running and accessible');
      throw error; // Re-throw to skip tests
    }
  });

  afterAll(async () => {
    if (dbClient) {
      try {
        await cleanupTestData();
        await dbClient.end();
      } catch (error) {
        console.warn('Error during test cleanup:', (error as Error).message);
      }
    }
    if (app) {
      await app.close();
    }
  });

  async function seedTestData() {
    // Create organizations
    await dbClient.query(`
      INSERT INTO hr.organizations (id, name, created_at, updated_at)
      VALUES 
        ($1, 'Organization A', NOW(), NOW()),
        ($2, 'Organization B', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [ORG_A, ORG_B]);

    // Create properties for each org
    await dbClient.query(`
      INSERT INTO hr.properties (id, organization_id, name, address)
      VALUES 
        ($1, $2, 'Property A', '123 Org A St'),
        ($3, $4, 'Property B', '456 Org B Ave')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [PROPERTY_A, ORG_A, PROPERTY_B, ORG_B]);

    // Create units for each org
    await dbClient.query(`
      INSERT INTO hr.units (id, organization_id, property_id, unit_number)
      VALUES 
        ($1, $2, $3, 'A101'),
        ($4, $5, $6, 'B201')
      ON CONFLICT (id) DO UPDATE SET unit_number = EXCLUDED.unit_number
    `, [UNIT_A, ORG_A, PROPERTY_A, UNIT_B, ORG_B, PROPERTY_B]);

    // Create tenants for each org
    await dbClient.query(`
      INSERT INTO hr.tenants (id, organization_id, unit_id, name, email, phone)
      VALUES 
        ($1, $2, $3, 'Tenant A', 'tenantA@test.com', '555-0001'),
        ($4, $5, $6, 'Tenant B', 'tenantB@test.com', '555-0002')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [TENANT_A, ORG_A, UNIT_A, TENANT_B, ORG_B, UNIT_B]);

    // Create technicians for each org
    await dbClient.query(`
      INSERT INTO hr.technicians (id, organization_id, name, email, phone)
      VALUES 
        ($1, $2, 'Tech A', 'techA@test.com', '555-0003'),
        ($3, $4, 'Tech B', 'techB@test.com', '555-0004')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [TECH_A, ORG_A, TECH_B, ORG_B]);
  }

  async function cleanupTestData() {
    // Clean up in reverse dependency order
    await dbClient.query('DELETE FROM hr.work_orders WHERE organization_id IN ($1, $2)', [ORG_A, ORG_B]);
    await dbClient.query('DELETE FROM hr.technicians WHERE organization_id IN ($1, $2)', [ORG_A, ORG_B]);
    await dbClient.query('DELETE FROM hr.tenants WHERE organization_id IN ($1, $2)', [ORG_A, ORG_B]);
    await dbClient.query('DELETE FROM hr.units WHERE organization_id IN ($1, $2)', [ORG_A, ORG_B]);
    await dbClient.query('DELETE FROM hr.properties WHERE organization_id IN ($1, $2)', [ORG_A, ORG_B]);
    await dbClient.query('DELETE FROM hr.organizations WHERE id IN ($1, $2)', [ORG_A, ORG_B]);
  }

  describe('Multi-tenant isolation', () => {
    it('should only return ORG_A data when x-org-id=ORG_A', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/lookups/properties')
        .set('x-org-id', ORG_A)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(PROPERTY_A);
      expect(response.body[0].name).toBe('Property A');
    });

    it('should only return ORG_B data when x-org-id=ORG_B', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/lookups/properties')
        .set('x-org-id', ORG_B)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(PROPERTY_B);
      expect(response.body[0].name).toBe('Property B');
    });

    it('should enforce isolation for units endpoint', async () => {
      const responseA = await request(app.getHttpServer())
        .get('/api/lookups/units')
        .set('x-org-id', ORG_A)
        .expect(200);

      const responseB = await request(app.getHttpServer())
        .get('/api/lookups/units')
        .set('x-org-id', ORG_B)
        .expect(200);

      expect(responseA.body).toHaveLength(1);
      expect(responseA.body[0].id).toBe(UNIT_A);
      
      expect(responseB.body).toHaveLength(1);
      expect(responseB.body[0].id).toBe(UNIT_B);

      // Ensure no cross-contamination
      expect(responseA.body[0].id).not.toBe(responseB.body[0].id);
    });

    it('should enforce isolation for tenants endpoint', async () => {
      const responseA = await request(app.getHttpServer())
        .get('/api/lookups/tenants')
        .set('x-org-id', ORG_A)
        .expect(200);

      const responseB = await request(app.getHttpServer())
        .get('/api/lookups/tenants')
        .set('x-org-id', ORG_B)
        .expect(200);

      expect(responseA.body).toHaveLength(1);
      expect(responseA.body[0].id).toBe(TENANT_A);
      expect(responseA.body[0].name).toBe('Tenant A');
      
      expect(responseB.body).toHaveLength(1);
      expect(responseB.body[0].id).toBe(TENANT_B);
      expect(responseB.body[0].name).toBe('Tenant B');
    });

    it('should enforce isolation for technicians endpoint', async () => {
      const responseA = await request(app.getHttpServer())
        .get('/api/lookups/technicians')
        .set('x-org-id', ORG_A)
        .expect(200);

      const responseB = await request(app.getHttpServer())
        .get('/api/lookups/technicians')
        .set('x-org-id', ORG_B)
        .expect(200);

      expect(responseA.body).toHaveLength(1);
      expect(responseA.body[0].id).toBe(TECH_A);
      
      expect(responseB.body).toHaveLength(1);
      expect(responseB.body[0].id).toBe(TECH_B);
    });
  });

  describe('Work order isolation', () => {
    let workOrderAId: string;
    let workOrderBId: string;

    beforeEach(async () => {
      // Create work orders for each org
      const woA = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', ORG_A)
        .send({
          unitId: UNIT_A,
          tenantId: TENANT_A,
          title: 'Work Order A',
          description: 'Test work order for Org A',
          priority: 'high'
        })
        .expect(201);

      const woB = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', ORG_B)
        .send({
          unitId: UNIT_B,
          tenantId: TENANT_B,
          title: 'Work Order B',
          description: 'Test work order for Org B',
          priority: 'normal'
        })
        .expect(201);

      workOrderAId = woA.body.id;
      workOrderBId = woB.body.id;
    });

    it('should not allow ORG_A to access ORG_B work order', async () => {
      await request(app.getHttpServer())
        .get(`/api/maintenance/work-orders/${workOrderBId}`)
        .set('x-org-id', ORG_A)
        .expect(404); // Should not find work order from different org
    });

    it('should not allow ORG_B to access ORG_A work order', async () => {
      await request(app.getHttpServer())
        .get(`/api/maintenance/work-orders/${workOrderAId}`)
        .set('x-org-id', ORG_B)
        .expect(404); // Should not find work order from different org
    });

    it('should allow org to access its own work order', async () => {
      const responseA = await request(app.getHttpServer())
        .get(`/api/maintenance/work-orders/${workOrderAId}`)
        .set('x-org-id', ORG_A)
        .expect(200);

      expect(responseA.body.id).toBe(workOrderAId);
      expect(responseA.body.title).toBe('Work Order A');

      const responseB = await request(app.getHttpServer())
        .get(`/api/maintenance/work-orders/${workOrderBId}`)
        .set('x-org-id', ORG_B)
        .expect(200);

      expect(responseB.body.id).toBe(workOrderBId);
      expect(responseB.body.title).toBe('Work Order B');
    });
  });

  describe('x-org-id header validation', () => {
    it('should reject request without x-org-id header', async () => {
      await request(app.getHttpServer())
        .get('/api/lookups/properties')
        .expect(400); // Should require org ID
    });

    it('should reject request with empty x-org-id', async () => {
      await request(app.getHttpServer())
        .get('/api/lookups/properties')
        .set('x-org-id', '')
        .expect(400);
    });

    it('should reject request with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/lookups/properties')
        .set('x-org-id', 'invalid-uuid')
        .expect(400);
    });

    it('should reject request with non-existent org ID', async () => {
      const nonExistentOrgId = '99999999-9999-9999-9999-999999999999';
      await request(app.getHttpServer())
        .get('/api/lookups/properties')
        .set('x-org-id', nonExistentOrgId)
        .expect(403); // Forbidden - org doesn't exist
    });

    it('should reject work order creation without x-org-id', async () => {
      await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .send({
          unitId: UNIT_A,
          tenantId: TENANT_A,
          title: 'Test Work Order',
          priority: 'high'
        })
        .expect(400);
    });
  });

  describe('Payment isolation', () => {
    it('should reject payment requests without x-org-id', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .send({
          chargeIds: ['66666666-6666-6666-6666-666666666666'],
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel'
        })
        .expect(400);
    });

    it('should reject payment webhook without proper org context', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .send({
          type: 'checkout.session.completed',
          data: { object: { id: 'test' } }
        })
        .expect(400);
    });
  });
});