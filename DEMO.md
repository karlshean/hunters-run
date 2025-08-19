# Demo Workflow Guide

This demonstrates the complete maintenance request workflow with full audit chain and RLS validation.

## Quick Start

```bash
# Start services
docker compose up -d

# Run migrations (includes demo seed data)
npm run migrate

# Start API
npm run dev:hr

# Run demo workflow (in separate terminal)
node scripts/demo-workflow.js
```

## Demo Entities

The following entities are created with fixed UUIDs for reproducible demos:

- **Organization**: `00000000-0000-0000-0000-000000000001` (Hunters Run Management)
- **Property**: `10000000-0000-0000-0000-000000000001` (Hunters Run Apartments)
- **Unit**: `20000000-0000-0000-0000-000000000001` (Apartment 101)
- **Tenant**: `30000000-0000-0000-0000-000000000001` (John Smith)
- **Technician**: `40000000-0000-0000-0000-000000000001` (Mike Wilson)

## Workflow Steps

### 1. Create Work Order
```bash
curl -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{
       "unitId": "20000000-0000-0000-0000-000000000001",
       "tenantId": "30000000-0000-0000-0000-000000000001", 
       "title": "Kitchen sink faucet leaking",
       "description": "Water dripping continuously",
       "priority": "high"
     }' \
     http://localhost:3000/api/maintenance/work-orders
```

### 2. Assign Technician
```bash
# Use work order ID from step 1
curl -X POST \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"technicianId": "40000000-0000-0000-0000-000000000001"}' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/assign
```

### 3. Progress Through Status Transitions
```bash
# Valid status flow: new → triaged → assigned → in_progress → completed → closed

# Triage
curl -X PATCH \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"toStatus": "triaged", "note": "Reviewed and prioritized"}' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/status

# Assign  
curl -X PATCH \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"toStatus": "assigned", "note": "Assigned to Mike"}' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/status

# Start work
curl -X PATCH \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"toStatus": "in_progress", "note": "Work started"}' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/status

# Complete
curl -X PATCH \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"toStatus": "completed", "note": "Faucet repaired"}' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/status
```

### 4. Test Invalid Transition (Should Return 422)
```bash
curl -X PATCH \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"toStatus": "new", "note": "Invalid backwards transition"}' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/status
```

### 5. Attach Evidence (Stub)
```bash
curl -X POST \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{
       "key": "evidence/2024/01/19/leak-photo-001.jpg",
       "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
       "mime": "image/jpeg", 
       "takenAt": "2024-01-19T10:30:00Z"
     }' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/evidence
```

### 6. Validate Audit Chain
```bash
curl -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/audit/validate
```

## Error Cases

### 400 - Invalid Data
```bash
curl -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"unitId": "invalid-uuid", "title": "", "priority": "invalid"}' \
     http://localhost:3000/api/maintenance/work-orders
```

### 403 - Missing Organization Header
```bash
curl -H "Content-Type: application/json" \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}
```

### 404 - Non-Existent Work Order
```bash
curl -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3000/api/maintenance/work-orders/99999999-9999-9999-9999-999999999999
```

### 422 - Invalid Status Transition  
```bash
# Try to go from 'completed' back to 'new' (invalid)
curl -X PATCH \
     -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"toStatus": "new"}' \
     http://localhost:3000/api/maintenance/work-orders/{WORK_ORDER_ID}/status
```

## Key Features Demonstrated

✅ **RLS Enforcement**: All operations require `x-org-id` header  
✅ **Status Machine**: Invalid transitions return 422  
✅ **Audit Logging**: Every CRUD operation creates audit event  
✅ **Hash Chain**: Cryptographic integrity validation  
✅ **Evidence Stub**: File attachment metadata (no S3 integration)  
✅ **Error Handling**: Proper HTTP status codes (400, 403, 404, 422)  
✅ **Fixed UUIDs**: Reproducible demo data  
✅ **Idempotent Seeds**: Re-runnable migrations  

## Expected Results

The demo workflow should show:
- Work order creation with status 'new'
- Valid status transitions through the workflow
- Invalid transitions rejected with detailed error messages
- Evidence attachment with generated ID
- Audit chain validation returning `valid: true`
- All operations isolated by organization ID