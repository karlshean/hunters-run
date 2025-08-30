const { Client } = require('pg');

(async () => {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('=== CREATING WORK ORDERS TEST DATA ===');
    
    const org1 = '00000000-0000-4000-8000-000000000001';
    const org2 = '00000000-0000-4000-8000-000000000002';
    
    // Create work orders for testing (as superuser to bypass RLS for setup)
    await client.query('BEGIN');
    
    // Clear any existing work orders to ensure clean test
    await client.query('DELETE FROM hr.work_orders WHERE organization_id IN ($1, $2)', [org1, org2]);
    
    // Insert test data for org 1
    await client.query(`
      INSERT INTO hr.work_orders (id, ticket_number, title, status, priority, organization_id, created_at) VALUES
      ($1, 'WO-001', 'Fix broken faucet in unit 101', 'open', 'medium', $2, NOW() - INTERVAL '2 days'),
      ($3, 'WO-002', 'Replace burned out light bulb', 'completed', 'low', $2, NOW() - INTERVAL '1 day'),
      ($4, 'WO-003', 'Repair heating system', 'in_progress', 'high', $2, NOW() - INTERVAL '3 hours'),
      ($5, 'WO-004', 'Clean carpets in lobby', 'open', 'medium', $2, NOW() - INTERVAL '1 hour')
    `, [
      '10000000-1111-4000-8000-000000000001',
      org1,
      '10000000-1111-4000-8000-000000000002',
      '10000000-1111-4000-8000-000000000003',
      '10000000-1111-4000-8000-000000000004'
    ]);
    
    // Insert test data for org 2  
    await client.query(`
      INSERT INTO hr.work_orders (id, ticket_number, title, status, priority, organization_id, created_at) VALUES
      ($1, 'WO-101', 'Fix elevator door', 'open', 'high', $2, NOW() - INTERVAL '4 hours'),
      ($3, 'WO-102', 'Replace air filter', 'completed', 'low', $2, NOW() - INTERVAL '2 days'),
      ($4, 'WO-103', 'Paint exterior walls', 'in_progress', 'medium', $2, NOW() - INTERVAL '1 day')
    `, [
      '20000000-2222-4000-8000-000000000001',
      org2,
      '20000000-2222-4000-8000-000000000002',
      '20000000-2222-4000-8000-000000000003'
    ]);
    
    await client.query('COMMIT');
    
    // Verify data creation
    const totalResult = await client.query('SELECT COUNT(*) as count FROM hr.work_orders WHERE organization_id IN ($1, $2)', [org1, org2]);
    const org1Result = await client.query('SELECT COUNT(*) as count FROM hr.work_orders WHERE organization_id = $1', [org1]);
    const org2Result = await client.query('SELECT COUNT(*) as count FROM hr.work_orders WHERE organization_id = $1', [org2]);
    
    console.log('✅ Test data created successfully:');
    console.log(`  Total work orders: ${totalResult.rows[0].count}`);
    console.log(`  Org 1 (${org1}): ${org1Result.rows[0].count} work orders`);
    console.log(`  Org 2 (${org2}): ${org2Result.rows[0].count} work orders`);
    
    await client.end();
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Failed to create test data:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
})();