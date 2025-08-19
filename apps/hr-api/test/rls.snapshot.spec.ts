import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';

describe('RLS Snapshot (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified'
    });
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('should have all RLS policies enabled on expected tables', async () => {
    const query = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE schemaname = 'hr'
      ORDER BY tablename, policyname;
    `;

    const result = await pool.query(query);

    // Expected RLS policies snapshot
    const expectedPolicies = [
      {
        tablename: 'audit_events',
        policyname: 'audit_events_org_policy',
        cmd: 'ALL',
      },
      {
        tablename: 'properties',
        policyname: 'properties_org_policy', 
        cmd: 'ALL',
      },
      {
        tablename: 'technicians',
        policyname: 'technicians_org_policy',
        cmd: 'ALL',
      },
      {
        tablename: 'tenants',
        policyname: 'tenants_org_policy',
        cmd: 'ALL',
      },
      {
        tablename: 'units',
        policyname: 'units_org_policy',
        cmd: 'ALL',
      },
      {
        tablename: 'work_orders',
        policyname: 'work_orders_org_policy',
        cmd: 'ALL',
      },
      {
        tablename: 'work_order_status_history',
        policyname: 'work_order_status_history_org_policy',
        cmd: 'ALL',
      },
    ];

    // Verify each expected policy exists
    expectedPolicies.forEach(expected => {
      const found = result.rows.find(row => 
        row.tablename === expected.tablename && 
        row.policyname === expected.policyname &&
        row.cmd === expected.cmd
      );
      
      expect(found).toBeDefined();
      expect(found.schemaname).toBe('hr');
      expect(found.permissive).toBe('PERMISSIVE');
      
      // All policies should filter on organization_id
      expect(found.qual).toContain('organization_id');
      expect(found.qual).toContain('current_setting');
      
      if (found.with_check) {
        expect(found.with_check).toContain('organization_id');
        expect(found.with_check).toContain('current_setting');
      }
    });

    // Verify we have exactly the expected number of policies
    expect(result.rows).toHaveLength(expectedPolicies.length);

    console.log(`✅ RLS Snapshot: ${result.rows.length} policies verified`);
  });

  it('should have RLS enabled on all expected tables', async () => {
    const query = `
      SELECT 
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'hr'
      AND rowsecurity = true
      ORDER BY tablename;
    `;

    const result = await pool.query(query);

    const expectedTables = [
      'audit_events',
      'properties', 
      'technicians',
      'tenants',
      'units',
      'work_orders',
      'work_order_status_history'
    ];

    expectedTables.forEach(tableName => {
      const found = result.rows.find(row => row.tablename === tableName);
      expect(found).toBeDefined();
      expect(found.rowsecurity).toBe(true);
    });

    expect(result.rows).toHaveLength(expectedTables.length);

    console.log(`✅ RLS Enabled: ${result.rows.length} tables with row security`);
  });

  it('should validate organization isolation', async () => {
    // Set organization context
    const org1 = '00000000-0000-0000-0000-000000000001';
    const org2 = '11111111-1111-1111-1111-111111111111';

    // Test that each org only sees its own data
    await pool.query(`SELECT set_config('app.current_org_id', $1, true)`, [org1]);
    
    const org1Units = await pool.query('SELECT COUNT(*) as count FROM hr.units');
    const org1Count = parseInt(org1Units.rows[0].count);
    
    expect(org1Count).toBeGreaterThan(0);

    // Switch to different org - should see no data
    await pool.query(`SELECT set_config('app.current_org_id', $1, true)`, [org2]);
    
    const org2Units = await pool.query('SELECT COUNT(*) as count FROM hr.units');
    const org2Count = parseInt(org2Units.rows[0].count);
    
    expect(org2Count).toBe(0);

    console.log(`✅ Organization Isolation: Org1 sees ${org1Count} units, Org2 sees ${org2Count} units`);
  });
});