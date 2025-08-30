const { Client } = require('pg');

(async () => {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    
    console.log('=== WORK ORDERS RLS VERIFICATION ===');
    const timestamp = new Date().toISOString();
    console.log('Timestamp:', timestamp);
    console.log('');

    // First check data without RLS (as postgres superuser)
    console.log('1. Data Check (without RLS):');
    const totalResult = await client.query('SELECT COUNT(*) as count FROM hr.work_orders');
    console.log('   Total work orders in database:', totalResult.rows[0].count);
    
    const byOrgResult = await client.query(`
      SELECT COUNT(*) as count, organization_id 
      FROM hr.work_orders 
      GROUP BY organization_id 
      ORDER BY organization_id
    `);
    console.log('   Work orders by organization:');
    byOrgResult.rows.forEach(row => {
      console.log(`     Org ${row.organization_id}: ${row.count} work orders`);
    });

    // Now test RLS filtering with app_user
    console.log('\n2. RLS Filtering Test (as app_user):');
    await client.query('SET ROLE app_user');
    console.log('   Switched to app_user role');

    const testOrgs = [
      { id: '00000000-0000-4000-8000-000000000001', label: 'Org 1' },
      { id: '00000000-0000-4000-8000-000000000002', label: 'Org 2' }
    ];

    const results = [];

    for (const org of testOrgs) {
      console.log(`\n   Testing ${org.label} (${org.id}):`);
      
      // Set org context for RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.org_id', org.id]);
      
      // Query work orders - should be filtered by RLS
      const countResult = await client.query('SELECT COUNT(*) as count FROM hr.work_orders');
      const workOrdersResult = await client.query(`
        SELECT id, title, organization_id 
        FROM hr.work_orders 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      const count = parseInt(countResult.rows[0].count);
      const workOrders = workOrdersResult.rows;
      
      console.log(`     Work orders count: ${count}`);
      console.log(`     Sample records: ${workOrders.length}`);
      
      // Verify all belong to the correct organization
      const wrongOrgItems = workOrders.filter(wo => wo.organization_id !== org.id);
      const rlsWorking = wrongOrgItems.length === 0;
      
      console.log(`     RLS filtering: ${rlsWorking ? '✅ WORKING' : '❌ FAILED'}`);
      if (!rlsWorking) {
        console.log(`       Items from wrong org: ${wrongOrgItems.length}`);
      }
      
      results.push({
        organizationId: org.id,
        organizationLabel: org.label,
        workOrdersCount: count,
        rlsFiltering: rlsWorking ? 'WORKING' : 'FAILED',
        status: rlsWorking ? 'PASS' : 'FAIL'
      });
    }

    // Summary
    const allPassed = results.every(r => r.status === 'PASS');
    console.log('\n=== VERIFICATION RESULTS ===');
    console.log('Overall Status:', allPassed ? '✅ PASS' : '❌ FAIL');
    console.log('Individual Results:');
    results.forEach(result => {
      console.log(`  ${result.organizationLabel}: ${result.workOrdersCount} work orders (${result.status})`);
    });

    // Create summary for documentation
    const summary = {
      timestamp,
      test_type: 'work_orders_rls_verification',
      overall_status: allPassed ? 'PASS' : 'FAIL',
      total_work_orders: parseInt(totalResult.rows[0].count),
      organization_distribution: byOrgResult.rows.map(row => ({
        organization_id: row.organization_id,
        count: parseInt(row.count)
      })),
      rls_test_results: results,
      rls_enforcement: allPassed ? 'VERIFIED' : 'FAILED',
      connection_method: 'postgres + SET ROLE app_user'
    };

    console.log('\n=== SUMMARY FOR DOCUMENTATION ===');
    console.log(JSON.stringify(summary, null, 2));

    await client.end();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
})();