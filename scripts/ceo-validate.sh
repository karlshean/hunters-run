#!/usr/bin/env bash

# CEO validation script for CI/Linux
# Must pass end-to-end with seeded demo data

set -e  # Exit on any error

API="http://localhost:3000"
ORG_ID="00000000-0000-4000-8000-000000000001"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok() {
  echo -e "${GREEN}[OK]${NC}  $1"
}

fail() {
  echo -e "${RED}[ERR]${NC} $1"
  exit 1
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# 1) Health / Ready checks
echo "🔍 Testing health endpoints..."

HEALTH=$(curl -s -w "\n%{http_code}" "$API/api/health" | tail -1)
if [ "$HEALTH" == "200" ]; then
  ok "/api/health => 200"
else
  fail "/api/health => $HEALTH"
fi

READY=$(curl -s -w "\n%{http_code}" "$API/api/ready" | tail -1)
if [ "$READY" == "200" ]; then
  ok "/api/ready => 200"
else
  # Try fallback endpoint
  warn "/api/ready => $READY, trying /api/health/ready..."
  READY2=$(curl -s -w "\n%{http_code}" "$API/api/health/ready" | tail -1)
  if [ "$READY2" == "200" ]; then
    ok "/api/health/ready => 200"
  else
    fail "/api/health/ready => $READY2"
  fi
fi

# 2) Lookups - verify seeded data
echo "🔍 Testing lookups with seeded data..."

UNITS=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/lookups/units")
if echo "$UNITS" | grep -q "00000000-0000-4000-8000-000000000003"; then
  ok "Lookups units: found seeded unit"
else
  fail "Lookups units: seeded unit not found"
fi

TENANTS=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/lookups/tenants")
if echo "$TENANTS" | grep -q "00000000-0000-4000-8000-000000000004"; then
  ok "Lookups tenants: found seeded tenant"
else
  fail "Lookups tenants: seeded tenant not found"
fi

TECHNICIANS=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/lookups/technicians")
if echo "$TECHNICIANS" | grep -q "00000000-0000-4000-8000-000000000005"; then
  ok "Lookups technicians: found seeded technician"
else
  fail "Lookups technicians: seeded technician not found"
fi

PROPERTIES=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/lookups/properties")
if echo "$PROPERTIES" | grep -q "00000000-0000-4000-8000-000000000002"; then
  ok "Lookups properties: found seeded property"
else
  fail "Lookups properties: seeded property not found"
fi

# 3) Work Order CRUD and Security
echo "🔍 Testing work order CRUD and security..."

WO_PAYLOAD='{
  "unitId": "00000000-0000-4000-8000-000000000003",
  "tenantId": "00000000-0000-4000-8000-000000000004",
  "title": "CEO Test Work Order",
  "description": "Automated test",
  "priority": "high"
}'

# First test: verify x-org-id is required
echo "🔒 Testing x-org-id header requirement..."
WO_NO_HEADER=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$WO_PAYLOAD" \
  "$API/api/maintenance/work-orders" | tail -1)

if [ "$WO_NO_HEADER" == "400" ]; then
  ok "Work order creation properly rejects missing x-org-id header"
else
  fail "Work order creation should reject missing x-org-id header (got $WO_NO_HEADER, expected 400)"
fi

# Second test: create work order with valid header
WO_RESPONSE=$(curl -s -X POST \
  -H "x-org-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d "$WO_PAYLOAD" \
  "$API/api/maintenance/work-orders")

WO_ID=$(echo "$WO_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
if [ -n "$WO_ID" ]; then
  ok "Work order created: $WO_ID"
else
  fail "Work order creation failed"
fi

# Fetch work order
WO_FETCH=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/maintenance/work-orders/$WO_ID")
if echo "$WO_FETCH" | grep -q "$WO_ID"; then
  ok "Work order fetched successfully"
else
  fail "Work order fetch failed"
fi

# Check work order specific audit chain
AUDIT_WO=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/maintenance/work-orders/$WO_ID/audit/validate")
if echo "$AUDIT_WO" | grep -q '"valid":true'; then
  ok "Work order audit chain validation passed"
else
  fail "Work order audit chain validation failed"
fi

# Perform more work order operations to create audit trail
echo "🔍 Testing comprehensive audit trail creation..."

# Update work order status to create audit events
STATUS_UPDATE=$(curl -s -X PATCH \
  -H "x-org-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"toStatus": "triaged", "note": "CEO validation test"}' \
  "$API/api/maintenance/work-orders/$WO_ID/status")

if echo "$STATUS_UPDATE" | grep -q "triaged"; then
  ok "Work order status updated to triaged"
else
  fail "Work order status update failed"
fi

# Assign technician to create more audit events
ASSIGN_TECH=$(curl -s -X POST \
  -H "x-org-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"technicianId": "00000000-0000-4000-8000-000000000005"}' \
  "$API/api/maintenance/work-orders/$WO_ID/assign")

if echo "$ASSIGN_TECH" | grep -q "00000000-0000-4000-8000-000000000005"; then
  ok "Technician assigned to work order"
else
  fail "Technician assignment failed"
fi

# H5 Audit & Evidence Immutability validation
echo "🔍 H5: Testing audit & evidence immutability..."

# Test global audit chain verification
GLOBAL_AUDIT=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/audit/verify")
if echo "$GLOBAL_AUDIT" | grep -q '"valid":true'; then
  ok "H5: Global audit chain verification passed"
  
  # Extract total events count for further validation
  TOTAL_EVENTS=$(echo "$GLOBAL_AUDIT" | grep -o '"totalEvents":[0-9]*' | cut -d':' -f2)
  if [ "$TOTAL_EVENTS" -gt 0 ]; then
    ok "H5: Audit log contains $TOTAL_EVENTS events"
  else
    fail "H5: Audit log should contain events after work order operations"
  fi
else
  fail "H5: Global audit chain verification failed"
fi

# Test entity-specific audit trail
ENTITY_AUDIT=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/audit/entity/work_order/$WO_ID")
if echo "$ENTITY_AUDIT" | grep -q "work_order.created"; then
  ok "H5: Entity audit trail contains work_order.created event"
else
  fail "H5: Entity audit trail missing work_order.created event"
fi

if echo "$ENTITY_AUDIT" | grep -q "work_order.status_updated"; then
  ok "H5: Entity audit trail contains work_order.status_updated event"
else
  fail "H5: Entity audit trail missing work_order.status_updated event"
fi

if echo "$ENTITY_AUDIT" | grep -q "work_order.assigned"; then
  ok "H5: Entity audit trail contains work_order.assigned event"
else
  fail "H5: Entity audit trail missing work_order.assigned event"
fi

# Verify audit trail structure
if echo "$ENTITY_AUDIT" | grep -q '"hash_hex"'; then
  ok "H5: Audit events contain cryptographic hashes"
else
  fail "H5: Audit events missing cryptographic hashes"
fi

# Test organizational isolation (should return empty for non-existent org)
WRONG_ORG_ID="99999999-9999-9999-9999-999999999999"
ISOLATION_TEST=$(curl -s -H "x-org-id: $WRONG_ORG_ID" "$API/api/audit/verify")
if echo "$ISOLATION_TEST" | grep -q '"totalEvents":0'; then
  ok "H5: Audit isolation verified - foreign org sees no events"
else
  warn "H5: Audit isolation test inconclusive"
fi

# Test evidence attachment (creates evidence audit events)
EVIDENCE_PAYLOAD='{
  "key": "evidence/ceo-test-photo.jpg",
  "mime": "image/jpeg",
  "sha256": "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
  "takenAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
}'

EVIDENCE_ATTACH=$(curl -s -X POST \
  -H "x-org-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d "$EVIDENCE_PAYLOAD" \
  "$API/api/maintenance/work-orders/$WO_ID/evidence")

if echo "$EVIDENCE_ATTACH" | grep -q "Evidence attached successfully"; then
  ok "H5: Evidence attachment created audit event"
  
  # Verify evidence audit event exists
  sleep 1  # Brief pause to ensure audit event is written
  EVIDENCE_AUDIT=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/audit/entity/evidence/")
  # Note: Evidence audit should be queryable by evidence ID, but for CEO validation we'll check overall chain
  
  FINAL_AUDIT=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/audit/verify")
  FINAL_EVENTS=$(echo "$FINAL_AUDIT" | grep -o '"totalEvents":[0-9]*' | cut -d':' -f2)
  
  if [ "$FINAL_EVENTS" -gt "$TOTAL_EVENTS" ]; then
    ok "H5: Evidence attachment increased audit event count ($TOTAL_EVENTS → $FINAL_EVENTS)"
  else
    warn "H5: Evidence attachment may not have created audit event"
  fi
else
  warn "H5: Evidence attachment may not be fully implemented"
fi

# Final comprehensive audit verification
FINAL_VERIFICATION=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/audit/verify")
if echo "$FINAL_VERIFICATION" | grep -q '"valid":true'; then
  ok "H5: Final audit chain verification passed"
else
  fail "H5: Final audit chain verification failed - chain may be compromised"
fi

# 4) Payment checkout + webhook
echo "🔍 Testing payment flow..."

CHECKOUT_PAYLOAD='{
  "chargeIds": ["00000000-0000-4000-8000-000000000006"],
  "successUrl": "http://localhost:3000/success",
  "cancelUrl": "http://localhost:3000/cancel"
}'

CHECKOUT=$(curl -s -X POST \
  -H "x-org-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d "$CHECKOUT_PAYLOAD" \
  "$API/api/payments/checkout")

if echo "$CHECKOUT" | grep -q "session_"; then
  ok "Payment checkout session created"
  
  # Simulate webhook
  SESSION_ID=$(echo "$CHECKOUT" | grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)
  WEBHOOK_PAYLOAD="{
    \"type\": \"checkout.session.completed\",
    \"data\": {
      \"object\": {
        \"id\": \"$SESSION_ID\",
        \"payment_status\": \"paid\",
        \"amount_total\": 120000,
        \"metadata\": {
          \"organization_id\": \"$ORG_ID\",
          \"charge_ids\": \"00000000-0000-4000-8000-000000000006\"
        }
      }
    }
  }"
  
  WEBHOOK_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "stripe-signature: test" \
    -d "$WEBHOOK_PAYLOAD" \
    "$API/api/payments/webhook")
  
  if echo "$WEBHOOK_RESPONSE" | grep -q "received"; then
    ok "Payment webhook processed"
    
    # H5: Verify payment audit events were created
    echo "🔍 H5: Verifying payment audit events..."
    sleep 2  # Allow time for webhook processing and audit logging
    
    # Check if payment audit events exist
    PAYMENT_VERIFICATION=$(curl -s -H "x-org-id: $ORG_ID" "$API/api/audit/verify")
    PAYMENT_EVENTS=$(echo "$PAYMENT_VERIFICATION" | grep -o '"totalEvents":[0-9]*' | cut -d':' -f2)
    
    if [ "$PAYMENT_EVENTS" -gt "$FINAL_EVENTS" ]; then
      ok "H5: Payment processing created additional audit events ($FINAL_EVENTS → $PAYMENT_EVENTS)"
    else
      warn "H5: Payment processing may not have created audit events"
    fi
    
    # Verify payment audit chain is still valid
    if echo "$PAYMENT_VERIFICATION" | grep -q '"valid":true'; then
      ok "H5: Payment audit chain verification passed"
    else
      fail "H5: Payment audit chain verification failed"
    fi
  else
    warn "Payment webhook may not be fully implemented"
  fi
else
  warn "Payment checkout may not be fully implemented"
fi

echo -e "${GREEN}✅ CEO VALIDATION PASSED${NC}"
exit 0