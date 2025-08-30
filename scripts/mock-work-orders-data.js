const { Client } = require('pg');

(async () => {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('=== CREATING MOCK WORK ORDERS DATA ===');
    
    const org1 = '00000000-0000-4000-8000-000000000001';
    const org2 = '00000000-0000-4000-8000-000000000002';
    
    // Clear existing work orders (as superuser)
    await client.query('DELETE FROM hr.work_orders');
    console.log('Cleared existing work orders');
    
    // Insert mock data for org 1
    await client.query(`
      INSERT INTO hr.work_orders (id, title, status, priority, organization_id, created_at) VALUES
      ($1, 'Fix broken faucet', 'open', 'medium', $2, NOW() - INTERVAL '1 day'),
      ($3, 'Replace light bulb', 'completed', 'low', $2, NOW() - INTERVAL '2 days'),
      ($4, 'Repair heating system', 'in_progress', 'high', $2, NOW() - INTERVAL '3 days')
    `, [
      '10000000-0000-4000-8000-000000000001',
      org1,
      '10000000-0000-4000-8000-000000000002', 
      org1,
      '10000000-0000-4000-8000-000000000003',
      org1
    ]);
    
    // Insert mock data for org 2
    await client.query(`
      INSERT INTO hr.work_orders (id, title, status, priority, organization_id, created_at) VALUES
      ($1, 'Clean windows', 'open', 'low', $2, NOW() - INTERVAL '1 hour'),
      ($3, 'Fix door lock', 'completed', 'high', $2, NOW() - INTERVAL '5 days')
    `, [
      '20000000-0000-4000-8000-000000000001',
      org2,
      '20000000-0000-4000-8000-000000000002',
      org2
    ]);
    
    console.log('Inserted mock work orders:');
    console.log('  Org 1: 3 work orders');
    console.log('  Org 2: 2 work orders');
    
    // Verify insertion
    const total = await client.query('SELECT COUNT(*) as count FROM hr.work_orders');
    console.log('Total work orders created:', total.rows[0].count);
    
    const byOrg = await client.query(`
      SELECT COUNT(*) as count, organization_id 
      FROM hr.work_orders 
      GROUP BY organization_id 
      ORDER BY organization_id
    `);
    console.log('Distribution:');
    byOrg.rows.forEach(row => {
      console.log(`  ${row.organization_id}: ${row.count} work orders`);
    });
    
    console.log('\n✅ Mock data creation completed');
    
    await client.end();
  } catch (error) {
    console.error('❌ Mock data creation failed:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
})();