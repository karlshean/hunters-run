import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Configuration for different test scenarios
const scenarios = {
  smoke: {
    executor: 'constant-arrival-rate',
    rate: 10, // 10 RPS for smoke test
    timeUnit: '1s',
    duration: '30s',
    preAllocatedVUs: 5,
    maxVUs: 10,
  },
  load: {
    executor: 'constant-arrival-rate',
    rate: 100, // 100 RPS target
    timeUnit: '1s',
    duration: '5m',
    preAllocatedVUs: 50,
    maxVUs: 100,
  }
};

// Default to smoke test, override with K6_SCENARIO env var
const scenarioName = __ENV.K6_SCENARIO || 'smoke';
export const options = {
  scenarios: {
    [scenarioName]: scenarios[scenarioName]
  },
  thresholds: {
    http_req_duration: ['p(95)<150'], // p95 < 150ms requirement
    errors: ['rate<0.01'], // error rate < 1%
    http_req_failed: ['rate<0.01'], // HTTP error rate < 1%
  },
};

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ORG_ID = __ENV.ORG_ID || '00000000-0000-4000-8000-000000000001'; // Demo org for CEO validation

// Sample work order IDs - in real scenario these would be dynamically created
let workOrderIds = [];

export function setup() {
  console.log(`Starting work-order reads test with scenario: ${scenarioName}`);
  console.log(`Target URL: ${BASE_URL}/api/maintenance/work-orders`);
  
  // Create some test work orders for reading
  const headers = {
    'Content-Type': 'application/json',
    'x-org-id': ORG_ID,
  };

  const testWorkOrders = [];
  
  // Create 10 test work orders for reading
  for (let i = 0; i < 10; i++) {
    const payload = {
      unitId: '00000000-0000-4000-8000-000000000003',
      tenantId: '00000000-0000-4000-8000-000000000004',
      title: `Load Test Work Order ${i + 1}`,
      description: `Performance testing work order created for load test ${i + 1}`,
      priority: Math.random() > 0.5 ? 'high' : 'normal',
    };

    const response = http.post(`${BASE_URL}/api/maintenance/work-orders`, JSON.stringify(payload), { headers });
    
    if (response.status === 200 || response.status === 201) {
      const workOrder = JSON.parse(response.body);
      testWorkOrders.push(workOrder.id);
      console.log(`Created test work order: ${workOrder.id}`);
    } else {
      console.error(`Failed to create test work order ${i + 1}: ${response.status} ${response.body}`);
    }
    
    sleep(0.1); // Brief pause between setup requests
  }
  
  return { workOrderIds: testWorkOrders };
}

export default function(data) {
  const headers = {
    'x-org-id': ORG_ID,
  };

  // Select random work order ID from setup data
  let workOrderId;
  if (data.workOrderIds && data.workOrderIds.length > 0) {
    workOrderId = data.workOrderIds[Math.floor(Math.random() * data.workOrderIds.length)];
  } else {
    // Fallback: generate a dummy work order ID
    workOrderId = `wo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const url = `${BASE_URL}/api/maintenance/work-orders/${workOrderId}`;
  
  const response = http.get(url, { headers });
  
  // Record custom metrics
  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);

  // Validate response
  const result = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 150ms': (r) => r.timings.duration < 150,
    'has work order data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && (body.id || body.error); // Accept both success and proper error responses
      } catch (e) {
        return false;
      }
    },
  });

  if (!result) {
    console.error(`Request failed: ${response.status} ${response.body}`);
  }

  // Small sleep to avoid overwhelming the system during ramp-up
  sleep(0.01);
}

export function teardown(data) {
  console.log('\n=== Work Order Reads Load Test Summary ===');
  console.log(`Scenario: ${scenarioName}`);
  console.log(`Target: 100 RPS work-order reads, p95 < 150ms`);
  console.log(`Test work orders created: ${data.workOrderIds ? data.workOrderIds.length : 0}`);
  console.log('==========================================\n');
}