# Load Testing with k6

This directory contains k6 load tests for the Hunters Run API, focusing on performance and reliability testing.

## Prerequisites

1. **Install k6**:
   - Windows: `choco install k6`
   - macOS: `brew install k6`
   - Linux: See [k6 installation docs](https://k6.io/docs/getting-started/installation/)

2. **Running services**: Ensure the application stack is running:
   ```bash
   npm run dev:stack
   ```

## Test Scripts

### work-order-reads.js
Tests read performance for work order endpoints.

**Targets:**
- **Smoke**: 10 RPS for 30 seconds
- **Load**: 100 RPS for 5 minutes, p95 < 150ms

**Usage:**
```bash
# Smoke test
K6_SCENARIO=smoke k6 run tests/load/work-order-reads.js

# Full load test
K6_SCENARIO=load k6 run tests/load/work-order-reads.js
```

### work-order-creates.js
Tests create performance for work order endpoints.

**Targets:**
- **Smoke**: 5 RPS for 30 seconds
- **Load**: 20 RPS for 5 minutes, error rate < 1%

**Usage:**
```bash
# Smoke test
K6_SCENARIO=smoke k6 run tests/load/work-order-creates.js

# Full load test
K6_SCENARIO=load k6 run tests/load/work-order-creates.js
```

## Environment Variables

- `K6_SCENARIO`: Test scenario (`smoke` or `load`)
- `BASE_URL`: API base URL (default: `http://localhost:3000`)
- `ORG_ID`: Organization ID for testing (default: demo org)

## Reports

Test results are saved to `reports/perf/` in JSON format:
- `reads-smoke.json`: Smoke test results for reads
- `reads-load.json`: Load test results for reads
- `creates-smoke.json`: Smoke test results for creates
- `creates-load.json`: Load test results for creates

## npm Scripts

Use these convenience scripts from the project root:

```bash
# Performance tests
npm run perf:smoke      # Run smoke tests only
npm run perf:load       # Run full load tests
npm run perf:all        # Run both smoke and load tests

# Chaos engineering
npm run chaos:redis     # Test Redis restart resilience
npm run chaos:postgres  # Test Postgres restart resilience
npm run chaos:all       # Run all chaos tests
```

## Thresholds

### Work Order Reads
- p95 response time < 150ms (load test)
- Error rate < 1%
- HTTP failure rate < 1%

### Work Order Creates
- Error rate < 1%
- HTTP failure rate < 1%
- p95 response time < 500ms

## Troubleshooting

1. **k6 not found**: Install k6 using the instructions above
2. **Connection refused**: Ensure the API is running on the expected port
3. **High error rates**: Check application logs and database connectivity
4. **Slow responses**: Monitor system resources (CPU, memory, disk I/O)

## CI/CD Integration

Tests run automatically in GitHub Actions:
- **Smoke tests**: Run on every PR and push to main
- **Full tests**: Manual trigger via workflow_dispatch

Results are uploaded as artifacts for analysis.