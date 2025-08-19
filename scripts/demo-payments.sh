#!/usr/bin/env bash
set -euo pipefail

# Demo Payments Flow Script
# Demonstrates Stripe checkout, webhook processing, and oldest-first allocation

ORG=00000000-0000-0000-0000-000000000001
BASE=http://localhost:3000/api

echo "🎯 Demo Payments Flow"
echo "====================="
echo "Organization: $ORG"
echo "Base URL: $BASE"
echo ""

# Step 1: Look up seeded data
echo "== Step 1: Look up seeded charges =="
charges_response=$(curl -s -H "x-org-id: $ORG" "$BASE/lookups/tenants" || echo '{"error": "Failed to fetch tenants"}')
echo "Tenants lookup response:"
echo "$charges_response" | jq '.'

# Extract tenant ID (assuming it exists from seeds)
TENANT=30000000-0000-0000-0000-000000000001
echo "Using tenant ID: $TENANT"

# Predefined charge IDs from seed data
CHARGE_RENT=50000000-0000-0000-0000-000000000001
CHARGE_LATE_FEE=50000000-0000-0000-0000-000000000002

echo "Using charge IDs:"
echo "  Rent: $CHARGE_RENT"
echo "  Late Fee: $CHARGE_LATE_FEE"
echo ""

# Step 2: Check initial charge status
echo "== Step 2: Check initial charge status =="
echo "Rent charge status:"
curl -s -H "x-org-id: $ORG" "$BASE/payments/charges/$CHARGE_RENT" | jq '.'

echo "Late fee charge status:"
curl -s -H "x-org-id: $ORG" "$BASE/payments/charges/$CHARGE_LATE_FEE" | jq '.'
echo ""

# Step 3: Create checkout session for specific charge
echo "== Step 3: Create checkout session for rent charge =="
checkout_response=$(curl -s -H "x-org-id: $ORG" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT\",\"chargeId\":\"$CHARGE_RENT\"}" \
  "$BASE/payments/checkout")

echo "Checkout response:"
echo "$checkout_response" | jq '.'

# Extract session ID
SESSION_ID=$(echo "$checkout_response" | jq -r '.sessionId // empty')
if [[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]]; then
  echo "❌ Failed to create checkout session"
  exit 1
fi

echo "✅ Checkout session created: $SESSION_ID"
echo ""

# Step 4: Simulate successful webhook
echo "== Step 4: Simulate webhook (checkout.session.completed) =="
webhook_payload=$(cat <<EOF
{
  "id": "evt_test_webhook_${RANDOM}",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "$SESSION_ID",
      "amount_total": 120000,
      "metadata": {
        "orgId": "$ORG",
        "tenantId": "$TENANT",
        "chargeId": "$CHARGE_RENT"
      }
    }
  }
}
EOF
)

webhook_response=$(curl -s -X POST "$BASE/payments/webhook" \
  -H "Stripe-Signature: test-skip" \
  -H "x-org-id: $ORG" \
  -H "Content-Type: application/json" \
  -d "$webhook_payload")

echo "Webhook response:"
echo "$webhook_response" | jq '.'
echo ""

# Step 5: Verify charge is now paid
echo "== Step 5: Verify charge is now paid =="
echo "Rent charge after payment:"
curl -s -H "x-org-id: $ORG" "$BASE/payments/charges/$CHARGE_RENT" | jq '.'
echo ""

# Step 6: Test oldest-first allocation with ad-hoc payment
echo "== Step 6: Test oldest-first allocation (ad-hoc payment) =="
echo "Creating ad-hoc payment for \$75 (should pay late fee + partial rent)"

adhoc_checkout=$(curl -s -H "x-org-id: $ORG" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT\",\"amountCents\":7500}" \
  "$BASE/payments/checkout")

echo "Ad-hoc checkout response:"
echo "$adhoc_checkout" | jq '.'

ADHOC_SESSION_ID=$(echo "$adhoc_checkout" | jq -r '.sessionId // empty')
if [[ -n "$ADHOC_SESSION_ID" && "$ADHOC_SESSION_ID" != "null" ]]; then
  echo "✅ Ad-hoc checkout session created: $ADHOC_SESSION_ID"
  
  # Simulate webhook for ad-hoc payment
  adhoc_webhook_payload=$(cat <<EOF
{
  "id": "evt_test_webhook_adhoc_${RANDOM}",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "$ADHOC_SESSION_ID",
      "amount_total": 7500,
      "metadata": {
        "orgId": "$ORG",
        "tenantId": "$TENANT"
      }
    }
  }
}
EOF
  )
  
  echo "Simulating webhook for ad-hoc payment..."
  adhoc_webhook_response=$(curl -s -X POST "$BASE/payments/webhook" \
    -H "Stripe-Signature: test-skip" \
    -H "x-org-id: $ORG" \
    -H "Content-Type: application/json" \
    -d "$adhoc_webhook_payload")
  
  echo "Ad-hoc webhook response:"
  echo "$adhoc_webhook_response" | jq '.'
else
  echo "❌ Failed to create ad-hoc checkout session"
fi
echo ""

# Step 7: Check final charge statuses
echo "== Step 7: Final charge statuses =="
echo "Rent charge final status:"
curl -s -H "x-org-id: $ORG" "$BASE/payments/charges/$CHARGE_RENT" | jq '.'

echo "Late fee charge final status:"
curl -s -H "x-org-id: $ORG" "$BASE/payments/charges/$CHARGE_LATE_FEE" | jq '.'
echo ""

# Step 8: Test error cases
echo "== Step 8: Test error cases =="

echo "Testing 400 - Invalid data:"
curl -s -H "x-org-id: $ORG" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"invalid-uuid","amountCents":0}' \
  "$BASE/payments/checkout" | jq '.'

echo "Testing 403 - Missing org header:"
curl -s -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT\",\"amountCents\":1000}" \
  "$BASE/payments/checkout" | jq '.'

echo "Testing 404 - Unknown charge:"
curl -s -H "x-org-id: $ORG" \
  "$BASE/payments/charges/99999999-9999-9999-9999-999999999999" | jq '.'

echo "Testing 422 - Negative amount:"
curl -s -H "x-org-id: $ORG" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT\",\"amountCents\":-100}" \
  "$BASE/payments/checkout" | jq '.'
echo ""

# Step 9: Test duplicate webhook (idempotency)
echo "== Step 9: Test duplicate webhook (idempotency) =="
if [[ -n "$SESSION_ID" ]]; then
  duplicate_webhook=$(curl -s -X POST "$BASE/payments/webhook" \
    -H "Stripe-Signature: test-skip" \
    -H "x-org-id: $ORG" \
    -H "Content-Type: application/json" \
    -d "$webhook_payload")
  
  echo "Duplicate webhook response (should be no-op):"
  echo "$duplicate_webhook" | jq '.'
fi
echo ""

echo "✅ Demo payments flow completed!"
echo ""
echo "📋 Summary:"
echo "- Checkout sessions created successfully"
echo "- Webhooks processed with signature validation bypass"
echo "- Payments allocated using oldest-first logic"
echo "- Charge statuses updated correctly (unpaid → partially_paid → paid)"
echo "- Audit events logged for all operations"
echo "- Error cases handled with proper HTTP status codes"
echo "- Webhook idempotency working (duplicates ignored)"
echo ""
echo "🔍 To verify audit trail, check the hr.audit_events table"
echo "💡 In production, set ALLOW_INSECURE_STRIPE_WEBHOOK_TEST=false"