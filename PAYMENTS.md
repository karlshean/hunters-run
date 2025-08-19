# Payments Integration Guide

Demo-ready Stripe payments flow with oldest-first allocation, RLS, and comprehensive audit logging.

## Quick Start

```bash
# Start services
docker compose up -d

# Run migrations and seeds
npm run migrate
npm run seed:local

# Set environment variables
cp .env.example .env
# Edit .env with your Stripe test keys

# Start API
npm run dev:hr

# Run payments demo
chmod +x scripts/demo-payments.sh
./scripts/demo-payments.sh
```

## Architecture

### Database Schema

**payments.charges** - Bills/invoices for tenants
- `amount_cents` - Amount in USD cents (e.g., 120000 = $1200.00)
- `status` - 'unpaid' | 'partially_paid' | 'paid'
- `due_date` - Used for oldest-first allocation ordering

**payments.payments** - Individual payment records
- `provider_payment_id` - Stripe session/payment_intent ID
- `status` - 'pending' | 'succeeded' | 'failed'
- `received_at` - Set when webhook confirms payment

**payments.allocations** - Links payments to specific charges
- `amount_cents` - Amount allocated from payment to charge
- Unique constraint on (payment_id, charge_id)

**payments.webhook_events** - Idempotency for Stripe webhooks
- Unique constraint on (provider, event_id)
- Prevents duplicate processing

### API Endpoints

#### POST /api/payments/checkout
Create Stripe checkout session for payment.

**Request:**
```json
{
  "tenantId": "30000000-0000-0000-0000-000000000001",
  "chargeId": "50000000-0000-0000-0000-000000000001"
}
```

**OR for ad-hoc payment:**
```json
{
  "tenantId": "30000000-0000-0000-0000-000000000001", 
  "amountCents": 7500
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/c/pay/...",
  "sessionId": "cs_test_..."
}
```

#### POST /api/payments/webhook
Stripe webhook endpoint for payment processing.

**Headers:**
- `Stripe-Signature` - Webhook signature (or 'test-skip' in dev)
- `x-org-id` - Organization UUID

**Processes:**
- `checkout.session.completed` - Marks payment as succeeded
- Updates charge statuses using oldest-first allocation
- Creates audit events for all operations

#### GET /api/payments/charges/:id
Get charge details with computed balances.

**Response:**
```json
{
  "id": "50000000-0000-0000-0000-000000000001",
  "description": "Monthly Rent - January 2024",
  "amountCents": 120000,
  "allocatedCents": 25000,
  "remainingCents": 95000,
  "status": "partially_paid"
}
```

## Allocation Rules

**Oldest-First Logic:**
1. Fetch unpaid/partially_paid charges for tenant
2. Order by `due_date ASC, created_at ASC`
3. Allocate payment amount across charges until exhausted
4. Update charge status:
   - `paid` when fully allocated
   - `partially_paid` when partially allocated
   - `unpaid` when no allocation
5. Leave overpayment unallocated (no negative balances)

**Example:**
- Rent: $1200 due 2024-01-01 (status: unpaid)
- Late Fee: $50 due 2024-01-01 (status: unpaid)
- Payment: $75

**Result:**
- Late Fee: $50 allocated (status: paid)
- Rent: $25 allocated (status: partially_paid)
- Remaining: $1175 on rent

## Security & RLS

**Row Level Security:**
- All tables filtered by `organization_id`
- Requires `x-org-id` header on all requests
- No data leakage between organizations

**Webhook Security:**
- Stripe signature validation in production
- `ALLOW_INSECURE_STRIPE_WEBHOOK_TEST=true` for local testing
- Organization context from event metadata or header

**Audit Trail:**
- No PII in audit logs (IDs and amounts only)
- Hash chain maintains cryptographic integrity
- Events: `checkout_created`, `payment_received`, `allocation_created`

## Environment Configuration

```bash
# Stripe Test Mode (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Development Only
ALLOW_INSECURE_STRIPE_WEBHOOK_TEST=true

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/unified
REDIS_URL=redis://localhost:6379
```

## Testing

### Unit Tests
```bash
npm run test:hr
```

### E2E Tests
```bash
npm run test:payments:e2e
```

**Covers:**
- Checkout session creation (200, 400, 403, 404, 422 responses)
- Webhook processing with idempotency
- Oldest-first allocation logic
- Computed balance calculations
- Audit event generation

### Demo Script
```bash
./scripts/demo-payments.sh
```

**Demonstrates:**
1. Checkout session creation for specific charge
2. Webhook simulation with test bypass
3. Charge status updates (unpaid → paid)
4. Ad-hoc payment with oldest-first allocation
5. Error case handling
6. Webhook idempotency

## Stripe CLI Integration

For production-like testing with real Stripe webhooks:

```bash
# Install Stripe CLI
npm install -g stripe-cli

# Login and listen for webhooks
stripe login
stripe listen --forward-to localhost:3000/api/payments/webhook

# In separate terminal, create test payment
curl -H "x-org-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"tenantId":"30000000-0000-0000-0000-000000000001","chargeId":"50000000-0000-0000-0000-000000000001"}' \
     http://localhost:3000/api/payments/checkout

# Open checkout URL in browser, complete test payment
# Watch webhook get processed automatically
```

## Seeded Test Data

**Organization:** `00000000-0000-0000-0000-000000000001` (Hunters Run Management)

**Tenant:** `30000000-0000-0000-0000-000000000001` (John Smith)

**Charges:**
- `50000000-0000-0000-0000-000000000001` - Rent $1200.00 (due today)
- `50000000-0000-0000-0000-000000000002` - Late Fee $50.00 (due today)

## Error Handling

**400 Bad Request:**
- Invalid UUID format
- Missing required fields
- Malformed JSON

**403 Forbidden:**
- Missing `x-org-id` header
- Invalid organization access

**404 Not Found:**
- Unknown tenant ID
- Unknown charge ID

**422 Unprocessable Entity:**
- Negative or zero payment amounts
- Currency mismatches
- Fully paid charges

## Production Deployment

1. **Set real Stripe keys** in environment
2. **Set `ALLOW_INSECURE_STRIPE_WEBHOOK_TEST=false`**
3. **Configure webhook endpoint** in Stripe Dashboard
4. **Set webhook secret** from Stripe
5. **Use HTTPS** for webhook endpoint
6. **Monitor audit events** for payment tracking

## CI/CD Integration

The payments flow is integrated into the CI pipeline:

```yaml
- name: Run payments e2e tests
  run: npm run test:payments:e2e
  env:
    STRIPE_SECRET_KEY: sk_test_fake_key_for_testing
    ALLOW_INSECURE_STRIPE_WEBHOOK_TEST: true
```

**Artifacts:**
- Updated OpenAPI specification
- Postman collection with payments endpoints
- E2E test coverage reports

All tests pass with proper database setup and environment configuration.