import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const createdWorkOrders = new Counter('work_orders_created');

// Configuration for different test scenarios
const scenarios = {
  smoke: {
    executor: 'constant-arrival-rate',
    rate: 5, // 5 RPS for smoke test
    timeUnit: '1s',
    duration: '30s',
    preAllocatedVUs: 3,
    maxVUs: 10,
  },
  load: {
    executor: 'constant-arrival-rate',
    rate: 20, // 20 RPS target
    timeUnit: '1s',
    duration: '5m',
    preAllocatedVUs: 10,
    maxVUs: 30,
  }
};

// Default to smoke test, override with K6_SCENARIO env var
const scenarioName = __ENV.K6_SCENARIO || 'smoke';
export const options = {
  scenarios: {
    [scenarioName]: scenarios[scenarioName]
  },
  thresholds: {
    errors: ['rate<0.01'], // error rate < 1% requirement
    http_req_failed: ['rate<0.01'], // HTTP error rate < 1%
    http_req_duration: ['p(95)<500'], // reasonable response time for creates
  },
};

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ORG_ID = __ENV.ORG_ID || '00000000-0000-4000-8000-000000000001'; // Demo org for CEO validation

// Sample data pools for realistic test data
const priorities = ['low', 'normal', 'high', 'urgent'];
const titles = [
  'Leaky faucet in bathroom',
  'Air conditioning not working',
  'Broken window lock',
  'Garbage disposal issue',
  'Electrical outlet not working',
  'Heating system malfunction',
  'Clogged drain',
  'Squeaky door hinges',
  'Smoke detector beeping',
  'Thermostat not responding'
];

const descriptions = [
  'Tenant reported water dripping continuously from bathroom faucet',
  'Unit temperature is too high, AC unit not responding to thermostat',
  'Window lock mechanism is broken, security concern',
  'Garbage disposal making loud grinding noise and not working properly',
  'Kitchen outlet has no power, may be electrical issue',
  'Heating system not producing warm air, tenant is cold',
  'Bathroom sink draining very slowly, possible blockage',
  'Front door hinges making loud squeaking noise',
  'Smoke detector chirping every few minutes, needs attention',
  'Thermostat display is blank and not responding to button presses'
];

export function setup() {
  console.log(`Starting work-order creates test with scenario: ${scenarioName}`);
  console.log(`Target URL: ${BASE_URL}/api/maintenance/work-orders`);
  console.log(`Target: 20 RPS work-order creates, error rate < 1%`);
  
  return {};
}

export default function() {
  const headers = {
    'Content-Type': 'application/json',
    'x-org-id': ORG_ID,
  };

  // Generate realistic test data
  const titleIndex = Math.floor(Math.random() * titles.length);
  const testId = Math.floor(Math.random() * 10000);
  
  const payload = {
    unitId: '00000000-0000-4000-8000-000000000003',
    tenantId: '00000000-0000-4000-8000-000000000004',
    title: `${titles[titleIndex]} - Test ${testId}`,
    description: `${descriptions[titleIndex]} (Load Test ${testId})`,
    priority: priorities[Math.floor(Math.random() * priorities.length)],
  };

  const response = http.post(`${BASE_URL}/api/maintenance/work-orders`, JSON.stringify(payload), { headers });
  
  // Record custom metrics
  const isError = response.status < 200 || response.status >= 400;
  errorRate.add(isError);
  
  if (!isError) {
    createdWorkOrders.add(1);
  }

  // Validate response
  const result = check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'error rate < 1%': () => errorRate.rate < 0.01,
    'has work order ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.id;
      } catch (e) {
        return false;
      }
    },
    'response time reasonable': (r) => r.timings.duration < 1000, // 1 second max for creates
  });

  if (!result || response.status >= 400) {
    console.error(`Create failed: ${response.status} ${response.body}`);
  } else {
    // Log successful creation for debugging (only occasionally to avoid spam)
    if (Math.random() < 0.1) { // 10% of requests
      try {
        const workOrder = JSON.parse(response.body);
        console.log(`Created work order: ${workOrder.id}`);
      } catch (e) {
        // Ignore parse errors for logging
      }
    }
  }

  // Small sleep to avoid overwhelming the system
  sleep(0.01);
}

export function teardown() {
  console.log('\n=== Work Order Creates Load Test Summary ===');
  console.log(`Scenario: ${scenarioName}`);
  console.log(`Target: 20 RPS work-order creates, error rate < 1%`);
  console.log('============================================\n');
}