import pkg from 'pg';
const { Client } = pkg;

const client = new Client({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL_MODE === 'relaxed' ? { rejectUnauthorized: false } : { rejectUnauthorized: true }
});

async function setupTestOrgs() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Create second organization for testing
    const orgResult = await client.query(`
      INSERT INTO platform.organizations (id, name, status) 
      VALUES ('11111111-1111-1111-1111-111111111111', 'Test Org B', 'active')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name
    `);
    
    if (orgResult.rows.length > 0) {
      console.log('✅ Created Test Org B:', orgResult.rows[0]);
    } else {
      console.log('✅ Test Org B already exists');
    }
    
    // Create test user for Org B
    const userResult = await client.query(`
      INSERT INTO platform.users (id, external_sub, external_provider, email) 
      VALUES ('22222222-2222-2222-2222-222222222222', 'user-org-b', 'dev', 'userb@example.com')
      ON CONFLICT (external_sub, external_provider) DO UPDATE SET 
        email = EXCLUDED.email
      RETURNING id, email
    `);
    
    console.log('✅ Created/Updated User for Org B:', userResult.rows[0]);
    
    // Create membership in Org B
    const membershipResult = await client.query(`
      INSERT INTO platform.memberships (user_id, organization_id, role_name) 
      VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'hr_admin')
      ON CONFLICT (user_id, organization_id) DO NOTHING
      RETURNING user_id
    `);
    
    if (membershipResult.rows.length > 0) {
      console.log('✅ Created membership for User Org B in Test Org B');
    } else {
      console.log('✅ Membership already exists for User Org B');
    }
    
    // Create some test work orders in both orgs for cross-org testing
    console.log('\n--- Creating test work orders ---');
    
    // Work order in Org A (Demo Organization)
    await client.query("SET app.current_organization = '00000000-0000-4000-8000-000000000001'");
    const woOrgA = await client.query(`
      INSERT INTO hr.work_orders (
        id, organization_id, ticket_number, title, description, priority, 
        tenant_name, tenant_phone, status, created_at, updated_at
      ) VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '00000000-0000-4000-8000-000000000001',
        'ORG-A-001', 
        'Work Order in Org A', 
        'This belongs to Demo Organization',
        'normal',
        'Tenant A',
        '555-0001',
        'open',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id, ticket_number, title
    `);
    
    if (woOrgA.rows.length > 0) {
      console.log('✅ Created work order in Org A:', woOrgA.rows[0]);
    } else {
      console.log('✅ Work order in Org A already exists');
    }
    
    // Work order in Org B
    await client.query("SET app.current_organization = '11111111-1111-1111-1111-111111111111'");
    const woOrgB = await client.query(`
      INSERT INTO hr.work_orders (
        id, organization_id, ticket_number, title, description, priority,
        tenant_name, tenant_phone, status, created_at, updated_at
      ) VALUES (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111',
        'ORG-B-001',
        'Work Order in Org B',
        'This belongs to Test Org B', 
        'high',
        'Tenant B',
        '555-0002',
        'open',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id, ticket_number, title
    `);
    
    if (woOrgB.rows.length > 0) {
      console.log('✅ Created work order in Org B:', woOrgB.rows[0]);
    } else {
      console.log('✅ Work order in Org B already exists');
    }
    
    // Clear org context
    await client.query('RESET app.current_organization');
    
    console.log('\n=== Test Environment Setup Complete ===');
    console.log('Org A (Demo): 00000000-0000-4000-8000-000000000001');
    console.log('Org B (Test): 11111111-1111-1111-1111-111111111111');
    console.log('User A Token: dev-token (maps to dev-user-123)');
    console.log('User B Token: dev-token-org-b (maps to user-org-b)');
    
    await client.end();
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

setupTestOrgs();