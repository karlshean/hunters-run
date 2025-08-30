const http = require('http');

// Cross-platform HTTP request utility
function makeHttpRequest(options, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);

    const req = http.request(options, (res) => {
      clearTimeout(timeoutId);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ 
            status: res.statusCode, 
            headers: res.headers, 
            data: parsed,
            rawData: data
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            headers: res.headers, 
            data: null,
            rawData: data,
            parseError: e.message
          });
        }
      });
    });
    
    req.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
    
    req.end();
  });
}

(async () => {
  console.log('=== WORK ORDERS API CURL PROBES ===');
  const timestamp = new Date().toISOString();
  console.log('Timestamp:', timestamp);
  console.log('');

  const baseUrl = process.env.API_BASE_URL || 'localhost:3000';
  const testOrgs = [
    { id: '00000000-0000-4000-8000-000000000001', label: 'Org 1' },
    { id: '00000000-0000-4000-8000-000000000002', label: 'Org 2' }
  ];

  const results = [];
  let overallStatus = 'PASS';

  for (const [index, org] of testOrgs.entries()) {
    console.log(`${index + 1}. Testing ${org.label} (${org.id}):`);
    
    try {
      const response = await makeHttpRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/work-orders',
        method: 'GET',
        headers: {
          'x-org-id': org.id,
          'Content-Type': 'application/json',
          'User-Agent': 'hunters-run-curl-probe/1.0'
        }
      });

      console.log(`  Status: ${response.status}`);
      
      if (response.status === 200 && response.data?.success) {
        const items = response.data.items || [];
        const count = response.data.count || 0;
        
        console.log(`  ✅ HTTP 200 OK`);
        console.log(`  Items returned: ${items.length}`);
        console.log(`  Total count: ${count}`);
        console.log(`  Organization ID: ${response.data.meta?.organizationId}`);
        
        // Verify all items belong to the correct org
        const wrongOrgItems = items.filter(item => item.organization_id !== org.id);
        const rlsWorking = wrongOrgItems.length === 0;
        
        if (rlsWorking) {
          console.log(`  ✅ RLS filtering verified - all items belong to ${org.label}`);
        } else {
          console.log(`  ❌ RLS filtering failed - ${wrongOrgItems.length} items from wrong org`);
          overallStatus = 'FAIL';
        }
        
        results.push({
          organization: org.label,
          organizationId: org.id,
          httpStatus: response.status,
          success: true,
          itemsCount: items.length,
          totalCount: count,
          rlsFiltering: rlsWorking ? 'WORKING' : 'FAILED',
          responseTime: 'N/A' // Could add timing if needed
        });
        
      } else if (response.status === 200) {
        console.log(`  ❌ HTTP 200 but invalid response structure`);
        console.log(`  Response:`, JSON.stringify(response.data, null, 2));
        overallStatus = 'FAIL';
        
        results.push({
          organization: org.label,
          organizationId: org.id,
          httpStatus: response.status,
          success: false,
          error: 'Invalid response structure',
          rawResponse: response.rawData
        });
        
      } else {
        console.log(`  ❌ HTTP ${response.status}`);
        console.log(`  Response:`, response.rawData || 'No response data');
        overallStatus = 'FAIL';
        
        results.push({
          organization: org.label,
          organizationId: org.id,
          httpStatus: response.status,
          success: false,
          error: `HTTP ${response.status}`,
          rawResponse: response.rawData
        });
      }
      
    } catch (error) {
      console.log(`  ❌ Request failed: ${error.message}`);
      overallStatus = 'FAIL';
      
      results.push({
        organization: org.label,
        organizationId: org.id,
        httpStatus: null,
        success: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  // Test without org header (should fail with 400)
  console.log('3. Testing without organization header (should fail):');
  try {
    const response = await makeHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/work-orders',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 400) {
      console.log('  ✅ HTTP 400 - Correctly rejected missing header');
    } else {
      console.log(`  ❌ Expected HTTP 400, got ${response.status}`);
      overallStatus = 'FAIL';
    }
  } catch (error) {
    console.log(`  ❌ Request error: ${error.message}`);
    overallStatus = 'FAIL';
  }
  
  console.log('');

  // Summary
  console.log('=== CURL PROBE SUMMARY ===');
  console.log(`Overall Status: ${overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  console.log('Per-Organization Results:');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${result.organization}: HTTP ${result.httpStatus || 'ERROR'} - ${result.totalCount || 0} items (${status})`);
  });

  // Generate structured output for documentation
  const probeResults = {
    timestamp,
    testType: 'work_orders_api_curl_probes',
    overallStatus,
    endpoint: '/api/work-orders',
    method: 'GET',
    organizationResults: results,
    summary: {
      totalOrganizationsTested: testOrgs.length,
      successfulResponses: results.filter(r => r.success).length,
      rlsVerified: results.filter(r => r.rlsFiltering === 'WORKING').length
    }
  };

  console.log('\\n=== STRUCTURED RESULTS FOR DOCUMENTATION ===');
  console.log(JSON.stringify(probeResults, null, 2));

  process.exit(overallStatus === 'PASS' ? 0 : 1);
})();