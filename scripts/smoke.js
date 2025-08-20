#!/usr/bin/env node

const http = require('http');

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const BASE_URL = 'http://localhost:3000';

let failures = 0;

// Wait for API to be ready with timeout
async function waitForApi(timeout = 60000) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const result = await makeRequest('GET', '/api/ready');
      if (result.status === 200) {
        console.log('✅ API is ready');
        return true;
      }
    } catch (error) {
      // API not ready yet, continue waiting
    }
    
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n❌ API did not become ready within timeout');
  return false;
}

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, body });
        } catch (e) {
          resolve({ status: res.statusCode, data: {}, body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function success(message) {
  console.log(`✅ ${message}`);
}

function failure(message) {
  console.log(`❌ ${message}`);
  failures++;
}

async function testHealthEndpoints() {
  console.log('🔍 Testing health endpoints...');
  
  try {
    const health = await makeRequest('GET', '/api/health');
    if (health.status === 200) {
      success('/api/health 200');
    } else {
      failure(`/api/health ${health.status}`);
    }
  } catch (e) {
    failure(`/api/health error: ${e.message}`);
  }

  try {
    const ready = await makeRequest('GET', '/api/ready');
    if (ready.status === 200) {
      success('/api/ready 200');
    } else {
      failure(`/api/ready ${ready.status}`);
    }
  } catch (e) {
    failure(`/api/ready error: ${e.message}`);
  }

  try {
    const healthReady = await makeRequest('GET', '/api/health/ready');
    if (healthReady.status === 200) {
      success('/api/health/ready 200');
    } else {
      failure(`/api/health/ready ${healthReady.status}`);
    }
  } catch (e) {
    failure(`/api/health/ready error: ${e.message}`);
  }
}

async function testLookups() {
  console.log('🔍 Testing lookup endpoints...');
  
  const lookupTypes = ['units', 'tenants', 'technicians', 'properties'];
  
  for (const type of lookupTypes) {
    try {
      const result = await makeRequest('GET', `/api/lookups/${type}`, null, {
        'x-org-id': ORG_ID
      });
      
      if (result.status === 200) {
        if (Array.isArray(result.data) && result.data.length > 0) {
          success(`Lookups ${type}: ${result.data.length} items`);
        } else {
          failure(`Lookups ${type}: empty array (expected seeded data)`);
        }
      } else {
        failure(`Lookups ${type}: status ${result.status}`);
      }
    } catch (e) {
      failure(`Lookups ${type}: error ${e.message}`);
    }
  }
}

async function testWorkOrderFlow() {
  console.log('🔍 Testing work order flow...');
  
  let workOrderId = null;

  // Create work order
  try {
    const createData = {
      unitId: '20000000-0000-0000-0000-000000000001',
      tenantId: '30000000-0000-0000-0000-000000000001',
      title: 'Smoke test work order',
      priority: 'high'
    };

    const createResult = await makeRequest('POST', '/api/maintenance/work-orders', createData, {
      'x-org-id': ORG_ID
    });

    if (createResult.status === 201) {
      workOrderId = createResult.data.id;
      success(`Create work order: ${workOrderId}`);
    } else {
      failure(`Create work order: status ${createResult.status}`);
      return;
    }
  } catch (e) {
    failure(`Create work order: error ${e.message}`);
    return;
  }

  // Test illegal status transition
  try {
    const illegalResult = await makeRequest('PATCH', `/api/maintenance/work-orders/${workOrderId}/status`, 
      { toStatus: 'completed' }, { 'x-org-id': ORG_ID });

    if (illegalResult.status === 422) {
      success('Illegal transition rejected with 422');
    } else {
      failure(`Illegal transition: expected 422, got ${illegalResult.status}`);
    }
  } catch (e) {
    failure(`Illegal transition test: error ${e.message}`);
  }

  // Valid status transitions
  const validTransitions = ['triaged', 'assigned', 'in_progress'];
  
  for (const status of validTransitions) {
    try {
      const result = await makeRequest('PATCH', `/api/maintenance/work-orders/${workOrderId}/status`,
        { toStatus: status }, { 'x-org-id': ORG_ID });

      if (result.status === 200) {
        success(`Status transition to ${status}`);
      } else {
        failure(`Status transition to ${status}: status ${result.status}`);
      }
    } catch (e) {
      failure(`Status transition to ${status}: error ${e.message}`);
    }
  }

  return workOrderId;
}

async function testAuditValidation(workOrderId) {
  console.log('🔍 Testing audit validation...');
  
  if (!workOrderId) {
    failure('Audit validation: no work order ID available');
    return;
  }

  try {
    const result = await makeRequest('GET', `/api/maintenance/work-orders/${workOrderId}/audit/validate`, null, {
      'x-org-id': ORG_ID
    });

    if (result.status === 200) {
      const { valid, eventsCount, headHash } = result.data;
      
      if (valid) {
        success(`Audit chain valid: ${eventsCount} events, head hash: ${headHash}`);
      } else {
        failure(`Audit chain invalid: ${eventsCount} events`);
      }
    } else {
      failure(`Audit validation: status ${result.status}`);
    }
  } catch (e) {
    failure(`Audit validation: error ${e.message}`);
  }
}

async function runSmokeTests() {
  console.log('🚀 Running smoke tests...\n');

  // Wait for API to be ready
  console.log('⏳ Waiting for API to be ready...');
  const apiReady = await waitForApi();
  if (!apiReady) {
    console.log('❌ API not ready - aborting smoke tests');
    process.exit(1);
  }

  console.log('');
  await testHealthEndpoints();
  console.log('');
  
  await testLookups();
  console.log('');
  
  const workOrderId = await testWorkOrderFlow();
  console.log('');
  
  await testAuditValidation(workOrderId);
  console.log('');

  if (failures > 0) {
    console.log(`❌ Smoke tests failed: ${failures} failures`);
    process.exit(1);
  } else {
    console.log('✅ All smoke tests passed!');
    process.exit(0);
  }
}

runSmokeTests();