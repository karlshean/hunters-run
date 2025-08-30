const { Client } = require('pg');

// Direct test of the work orders service logic without NestJS
async function testWorkOrdersService(client, orgId) {
  // Set org context for RLS (simulating the service behavior)
  await client.query('SET ROLE app_user');
  await client.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);
  
  // Query work orders - RLS will automatically filter by organization
  const [rows, countResult] = await Promise.all([
    client.query('SELECT id, ticket_number, title, status, priority, created_at, organization_id FROM hr.work_orders ORDER BY created_at DESC'),
    client.query('SELECT COUNT(*) as count FROM hr.work_orders')
  ]);

  const count = parseInt(countResult[0]?.count || '0');

  return {
    workOrders: rows,
    count,
    orgId
  };
}

(async () => {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    
    console.log('=== DIRECT API LOGIC TEST ===');
    const timestamp = new Date().toISOString();
    console.log('Timestamp:', timestamp);
    console.log('');

    const testOrgs = [
      { id: '00000000-0000-4000-8000-000000000001', label: 'Org 1' },
      { id: '00000000-0000-4000-8000-000000000002', label: 'Org 2' }
    ];

    const results = [];
    let overallStatus = 'PASS';

    for (const org of testOrgs) {
      console.log(`Testing ${org.label} (${org.id}):`);
      
      try {
        const result = await testWorkOrdersService(client, org.id);
        
        // Format response like the API would
        const apiResponse = {
          success: true,
          items: result.workOrders,
          count: result.count,
          meta: {
            organizationId: result.orgId
          }
        };

        console.log(`  ✅ Service logic successful`);
        console.log(`  Items returned: ${apiResponse.items.length}`);
        console.log(`  Total count: ${apiResponse.count}`);
        console.log(`  Organization ID: ${apiResponse.meta.organizationId}`);
        
        // Verify all items belong to the correct org
        const wrongOrgItems = apiResponse.items.filter(item => item.organization_id !== org.id);
        const rlsWorking = wrongOrgItems.length === 0;
        
        console.log(`  RLS Filtering: ${rlsWorking ? '✅ WORKING' : '❌ FAILED'}`);
        if (!rlsWorking) {
          console.log(`    Items from wrong org: ${wrongOrgItems.length}`);
          overallStatus = 'FAIL';
        }
        
        results.push({
          organization: org.label,
          organizationId: org.id,
          httpStatus: 200, // Simulated
          success: true,
          itemsCount: apiResponse.items.length,
          totalCount: apiResponse.count,
          rlsFiltering: rlsWorking ? 'WORKING' : 'FAILED',
          simulatedResponse: {
            success: apiResponse.success,
            count: apiResponse.count,
            meta: apiResponse.meta
          }
        });
        
      } catch (error) {
        console.log(`  ❌ Service logic failed: ${error.message}`);
        overallStatus = 'FAIL';
        
        results.push({
          organization: org.label,
          organizationId: org.id,
          httpStatus: 500,
          success: false,
          error: error.message
        });
      }
      
      console.log('');
    }

    // Summary
    console.log('=== API LOGIC TEST SUMMARY ===');
    console.log(`Overall Status: ${overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    console.log('Per-Organization Results:');
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${result.organization}: HTTP ${result.httpStatus} - ${result.totalCount || 0} items (${status})`);
    });

    // Generate structured output for documentation
    const testResults = {
      timestamp,
      testType: 'work_orders_api_logic_test',
      overallStatus,
      endpoint: '/api/work-orders',
      method: 'GET',
      testMode: 'direct_service_logic',
      organizationResults: results,
      summary: {
        totalOrganizationsTested: testOrgs.length,
        successfulResponses: results.filter(r => r.success).length,
        rlsVerified: results.filter(r => r.rlsFiltering === 'WORKING').length
      }
    };

    console.log('\\n=== STRUCTURED RESULTS FOR DOCUMENTATION ===');
    console.log(JSON.stringify(testResults, null, 2));

    await client.end();
    process.exit(overallStatus === 'PASS' ? 0 : 1);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
})();