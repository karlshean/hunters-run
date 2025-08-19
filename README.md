# Hunters Run – Public Monorepo

- Node 20, Postgres 16, Redis 7
- npm workspaces
- Docker Compose for local DBs
- API (apps/hr-api) with maintenance workflow, RLS, and audit chain
- SQL migrations (packages/db/migrations)

## Quick start
```bash
cp .env.example .env   # fill later
npm ci
docker compose up -d
npm run migrate
npm run seed:local
npm run dev:hr
curl -i http://localhost:3000/api/ready
```

## Smoke Test

Complete end-to-end verification of the maintenance workflow:

### 1. Setup
```bash
docker compose up -d
npm install
npm run migrate
npm run seed:local
npm run dev:hr
```

### 2. Lookups (returns seeded entities)
```bash
ORG=00000000-0000-0000-0000-000000000001

# Get all lookup data
curl -H "x-org-id: $ORG" http://localhost:3000/api/lookups/units | jq
curl -H "x-org-id: $ORG" http://localhost:3000/api/lookups/tenants | jq
curl -H "x-org-id: $ORG" http://localhost:3000/api/lookups/technicians | jq
curl -H "x-org-id: $ORG" http://localhost:3000/api/lookups/properties | jq
```

### 3. Create Work Order
```bash
curl -s -H "x-org-id: $ORG" -H "Content-Type: application/json" \
  -d '{"unitId":"20000000-0000-0000-0000-000000000001","tenantId":"30000000-0000-0000-0000-000000000001","title":"Leaking sink","priority":"high"}' \
  http://localhost:3000/api/maintenance/work-orders | jq

# Save the work order ID for next steps
WO_ID=$(curl -s -H "x-org-id: $ORG" -H "Content-Type: application/json" \
  -d '{"unitId":"20000000-0000-0000-0000-000000000001","tenantId":"30000000-0000-0000-0000-000000000001","title":"Test WO","priority":"normal"}' \
  http://localhost:3000/api/maintenance/work-orders | jq -r '.id')
```

### 4. Status Transitions (Valid Flow)
```bash
# new → triaged
curl -s -X PATCH -H "x-org-id: $ORG" -H "Content-Type: application/json" \
  -d '{"toStatus":"triaged"}' \
  http://localhost:3000/api/maintenance/work-orders/$WO_ID/status | jq

# triaged → assigned  
curl -s -X PATCH -H "x-org-id: $ORG" -H "Content-Type: application/json" \
  -d '{"toStatus":"assigned"}' \
  http://localhost:3000/api/maintenance/work-orders/$WO_ID/status | jq

# assigned → in_progress
curl -s -X PATCH -H "x-org-id: $ORG" -H "Content-Type: application/json" \
  -d '{"toStatus":"in_progress"}' \
  http://localhost:3000/api/maintenance/work-orders/$WO_ID/status | jq
```

### 5. Illegal Status Transition (expect 422)
```bash
# Try to go directly from in_progress → closed (invalid)
curl -s -X PATCH -H "x-org-id: $ORG" -H "Content-Type: application/json" \
  -d '{"toStatus":"closed"}' \
  http://localhost:3000/api/maintenance/work-orders/$WO_ID/status | jq
```

### 6. Audit Chain Validation
```bash
# Validate the audit chain (should return valid: true)
curl -s -H "x-org-id: $ORG" \
  http://localhost:3000/api/maintenance/work-orders/$WO_ID/audit/validate | jq
```

### 7. Negative Cases
```bash
# Missing org header (expect 403)
curl -s http://localhost:3000/api/lookups/units | jq

# Invalid org ID (expect 403)  
curl -s -H "x-org-id: invalid-uuid" http://localhost:3000/api/lookups/units | jq

# Non-existent work order (expect 404)
curl -s -H "x-org-id: $ORG" \
  http://localhost:3000/api/maintenance/work-orders/99999999-9999-9999-9999-999999999999 | jq

# Invalid payload (expect 400)
curl -s -H "x-org-id: $ORG" -H "Content-Type: application/json" \
  -d '{"unitId":"invalid","priority":"invalid"}' \
  http://localhost:3000/api/maintenance/work-orders | jq
```

### 8. Run E2E Tests
```bash
npm run test:hr:e2e
```

### Expected Results
- ✅ All lookups return seeded data for valid org, empty arrays for unknown org
- ✅ Work order creation succeeds with valid payload, fails with 400 for invalid
- ✅ Status transitions follow state machine rules, illegal transitions return 422
- ✅ Audit validation returns `{"valid": true, "eventsCount": N, "headHash": "..."}`
- ✅ Negative cases return appropriate HTTP status codes (403, 404, 400, 422)
- ✅ E2E tests pass completely