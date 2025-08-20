// Validation script to test k6 setup and API connectivity
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  duration: '10s',
  vus: 1,
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ORG_ID = __ENV.ORG_ID || '00000000-0000-4000-8000-000000000001';

export default function() {
  const headers = {
    'Content-Type': 'application/json',
    'x-org-id': ORG_ID,
  };

  // Test health endpoint
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  check(healthResponse, {
    'health endpoint returns 200': (r) => r.status === 200,
    'health response has ok field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ok === true;
      } catch (e) {
        return false;
      }
    },
  });

  // Test ready endpoint
  const readyResponse = http.get(`${BASE_URL}/api/ready`);
  check(readyResponse, {
    'ready endpoint returns 200': (r) => r.status === 200,
  });

  // Test work order creation
  const payload = {
    unitId: '00000000-0000-4000-8000-000000000003',
    tenantId: '00000000-0000-4000-8000-000000000004',
    title: 'Validation Test Work Order',
    description: 'Test work order created during validation',
    priority: 'normal',
  };

  const createResponse = http.post(`${BASE_URL}/api/maintenance/work-orders`, JSON.stringify(payload), { headers });
  const workOrderCreated = check(createResponse, {
    'work order creation returns 200/201': (r) => r.status === 200 || r.status === 201,
    'work order has ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.id;
      } catch (e) {
        return false;
      }
    },
  });

  // If work order was created, test reading it
  if (workOrderCreated && createResponse.status < 300) {
    try {
      const workOrder = JSON.parse(createResponse.body);
      const readResponse = http.get(`${BASE_URL}/api/maintenance/work-orders/${workOrder.id}`, { headers });
      
      check(readResponse, {
        'work order read returns 200': (r) => r.status === 200,
        'work order read has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body && body.id === workOrder.id;
          } catch (e) {
            return false;
          }
        },
      });
    } catch (e) {
      console.error('Failed to test work order read:', e.message);
    }
  }
}

export function teardown() {
  console.log('\n=== Validation Test Summary ===');
  console.log(`API Base URL: ${BASE_URL}`);
  console.log(`Organization ID: ${ORG_ID}`);
  console.log('If all checks passed, the system is ready for load testing!');
  console.log('==============================\n');
}