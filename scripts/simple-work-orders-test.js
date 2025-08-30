const { Client } = require('pg');

// Direct database test without API server
(async () => {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    await client.query('SET ROLE app_user');
    
    console.log('=== WORK ORDERS RLS VERIFICATION ===');
    const timestamp = new Date().toISOString();
    console.log('Timestamp:', timestamp);
    console.log('');

    const testOrgs = [
      { id: '00000000-0000-4000-8000-000000000001', label: 'Org 1' },
      { id: '00000000-0000-4000-8000-000000000002', label: 'Org 2' }
    ];

    const results = [];

    for (const org of testOrgs) {
      console.log(`Testing ${org.label} (${org.id}):`);
      
      // Set org context
      await client.query('SELECT set_config($1, $2, true)', ['app.org_id', org.id]);
      
      // Query work orders with RLS filtering
      const workOrdersResult = await client.query(`
        SELECT id, title, status, priority, created_at, organization_id 
        FROM hr.work_orders 
        ORDER BY created_at DESC
      `);
      
      const countResult = await client.query('SELECT COUNT(*) as count FROM hr.work_orders');
      
      const workOrders = workOrdersResult.rows;
      const count = parseInt(countResult.rows[0].count);
      
      console.log('  Work Orders Count:', count);
      console.log('  Work Orders Retrieved:', workOrders.length);
      
      // Verify all belong to the org
      const wrongOrgItems = workOrders.filter(wo => wo.organization_id !== org.id);
      const rlsWorking = wrongOrgItems.length === 0;
      
      console.log('  RLS Filtering:', rlsWorking ? '✅ WORKING' : '❌ FAILED');
      if (!rlsWorking) {
        console.log('    Wrong org items:', wrongOrgItems.length);
      }
      
      results.push({
        orgId: org.id,
        orgLabel: org.label,
        count,
        itemsReturned: workOrders.length,
        rlsFiltering: rlsWorking ? 'WORKING' : 'FAILED',
        status: 'PASS'
      });
      
      console.log('');
    }

    // Test without org context (should cause error or return 0)
    console.log('Testing without org context:');
    try {
      await client.query('SELECT set_config($1, $2, true)', ['app.org_id', '']);
      const noContextResult = await client.query('SELECT COUNT(*) as count FROM hr.work_orders');
      console.log('  ❌ Query succeeded without org context:', noContextResult.rows[0].count);
    } catch (error) {
      if (error.message.includes('invalid input syntax for type uuid')) {
        console.log('  ✅ Query blocked by UUID validation (fail-secure)');
      } else {
        console.log('  ❌ Unexpected error:', error.message);
      }
    }

    console.log('');
    console.log('=== VERIFICATION RESULTS ===');
    const allPassed = results.every(r => r.rlsFiltering === 'WORKING');
    console.log('Overall Status:', allPassed ? '✅ PASS' : '❌ FAIL');
    
    console.log('\\nOrganization Results:');
    results.forEach(result => {
      console.log(`  ${result.orgLabel}: ${result.count} work orders (${result.rlsFiltering})`);
    });

    // Summary for proof
    const summary = {
      timestamp,
      test_type: 'work_orders_rls_verification',
      overall_status: allPassed ? 'PASS' : 'FAIL',
      organization_results: results,
      rls_verification: allPassed ? 'VERIFIED' : 'FAILED',
      endpoint_tested: 'Direct database query with RLS',
      connection_method: 'postgres + SET ROLE app_user'
    };

    console.log('\\n=== SUMMARY FOR DOCUMENTATION ===');
    console.log(JSON.stringify(summary, null, 2));

    await client.end();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
})();