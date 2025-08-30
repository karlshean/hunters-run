const http = require('http');

// Simple HTTP request wrapper
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('=== WORK ORDERS SMOKE TEST ===');
  const timestamp = new Date().toISOString();
  console.log('Timestamp:', timestamp);
  console.log('');

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const testOrgs = [
    '00000000-0000-4000-8000-000000000001', // Org 1
    '00000000-0000-4000-8000-000000000002'  // Org 2
  ];

  const results = [];

  console.log('1. Testing Work Orders API Endpoint:');
  console.log('  Base URL:', baseUrl);
  console.log('  Test Organizations:', testOrgs.length);
  console.log('');

  for (const [index, orgId] of testOrgs.entries()) {
    const orgLabel = `Org ${index + 1}`;
    console.log(`2.${index + 1} Testing ${orgLabel} (${orgId}):`);
    
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/work-orders',
        method: 'GET',
        headers: {
          'x-org-id': orgId,
          'Content-Type': 'application/json'
        }
      });

      console.log('  Status:', response.status);
      
      if (response.status === 200 && response.data.success) {
        const count = response.data.meta?.count || 0;
        const workOrders = response.data.data || [];
        
        console.log('  ✅ Request successful');
        console.log('  Work Orders Count:', count);
        console.log('  Work Orders Returned:', workOrders.length);
        console.log('  Organization ID:', response.data.meta?.organizationId);
        
        // Verify all returned work orders belong to the org
        const wrongOrgItems = workOrders.filter(wo => wo.organization_id !== orgId);
        if (wrongOrgItems.length === 0) {
          console.log('  ✅ RLS filtering verified - all items belong to org');
        } else {
          console.log('  ❌ RLS filtering failed - found items from other orgs:', wrongOrgItems.length);
        }
        
        results.push({
          orgId,
          orgLabel,
          status: 'PASS',
          count,
          itemsReturned: workOrders.length,
          rlsFiltering: wrongOrgItems.length === 0 ? 'WORKING' : 'FAILED',
          response: {
            status: response.status,
            success: response.data.success,
            meta: response.data.meta
          }
        });
        
      } else {
        console.log('  ❌ Request failed');
        console.log('  Response:', JSON.stringify(response.data, null, 2));
        
        results.push({
          orgId,
          orgLabel,
          status: 'FAIL',
          count: 0,
          itemsReturned: 0,
          rlsFiltering: 'UNKNOWN',
          error: response.data,
          response: {
            status: response.status
          }
        });
      }
      
    } catch (error) {
      console.log('  ❌ Request error:', error.message);
      
      results.push({
        orgId,
        orgLabel,
        status: 'ERROR',
        count: 0,
        itemsReturned: 0,
        rlsFiltering: 'UNKNOWN',
        error: error.message
      });
    }
    
    console.log('');
  }

  // Test without org header (should fail)
  console.log('3. Testing without organization header:');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/work-orders',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('  Status:', response.status);
    if (response.status === 400) {
      console.log('  ✅ Correctly rejected request without org header');
    } else {
      console.log('  ❌ Should have rejected request without org header');
    }
  } catch (error) {
    console.log('  ❌ Request error:', error.message);
  }
  
  console.log('');

  // Summary
  const passCount = results.filter(r => r.status === 'PASS').length;
  const totalTests = results.length;
  
  console.log('=== SMOKE TEST RESULTS ===');
  console.log('Tests passed:', passCount + '/' + totalTests);
  console.log('Overall status:', passCount === totalTests ? '✅ PASS' : '❌ FAIL');
  
  console.log('\\nOrganization Results:');
  results.forEach(result => {
    console.log(`  ${result.orgLabel}: ${result.count} work orders (${result.status})`);
  });

  // Summary for proof documentation
  const summary = {
    timestamp,
    test_type: 'work_orders_api_smoke_test',
    overall_status: passCount === totalTests ? 'PASS' : 'FAIL',
    tests_passed: passCount,
    tests_total: totalTests,
    organization_results: results.map(r => ({
      organization_id: r.orgId,
      organization_label: r.orgLabel,
      status: r.status,
      work_orders_count: r.count,
      rls_filtering: r.rlsFiltering
    })),
    endpoint_tested: '/api/work-orders',
    rls_verification: results.every(r => r.rlsFiltering === 'WORKING' || r.status !== 'PASS') ? 'VERIFIED' : 'FAILED'
  };

  console.log('\\n=== SUMMARY FOR DOCUMENTATION ===');
  console.log(JSON.stringify(summary, null, 2));

  process.exit(passCount === totalTests ? 0 : 1);
})();