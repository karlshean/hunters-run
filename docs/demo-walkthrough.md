# Demo Walkthrough - Visual Guide

This visual walkthrough demonstrates the complete maintenance workflow from tenant submission to audit verification.

## 🎬 Demo Flow Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   TENANT    │────▶│   MANAGER   │────▶│ TECHNICIAN  │────▶│    AUDIT    │
│   Creates   │     │   Assigns   │     │  Completes  │     │   Verifies  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │                    │
      ▼                   ▼                    ▼                    ▼
  [Photo+Form]       [Assignment]         [Work Done]         [Hash Chain]
   WO-2025-001        Mike Johnson         Completed            ✅ Valid
```

## Step 1: Tenant Portal - Submit Issue

### Navigate to: `http://localhost:3004/tenant`

```
┌────────────────────────────────────────────────────────────────────┐
│  🏠 Tenant Portal                                    [Role: Tenant] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Submit Maintenance Request                                       │
│  ─────────────────────────────                                   │
│                                                                    │
│  📸 Photo Evidence *                                              │
│  ┌──────────────────────────────────────┐                       │
│  │ [Choose File] bathroom_leak.jpg      │                       │
│  └──────────────────────────────────────┘                       │
│                                                                    │
│  📝 Issue Title *                                                │
│  ┌──────────────────────────────────────┐                       │
│  │ Bathroom sink leaking                │                       │
│  └──────────────────────────────────────┘                       │
│                                                                    │
│  📋 Description                                                   │
│  ┌──────────────────────────────────────┐                       │
│  │ Water dripping from under sink,      │                       │
│  │ creating puddle on floor              │                       │
│  └──────────────────────────────────────┘                       │
│                                                                    │
│  Priority: [Normal ▼]                                            │
│                                                                    │
│  ┌─────────────────────────┐                                    │
│  │   Submit Work Order     │                                    │
│  └─────────────────────────┘                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Success Response:
```
┌────────────────────────────────────────────────────────────────────┐
│  ✅ Work order created! Ticket ID: WO-2025-0001                   │
└────────────────────────────────────────────────────────────────────┘
```

## Step 2: Manager Dashboard - Assign & Track

### Navigate to: `http://localhost:3004/manager`

```
┌────────────────────────────────────────────────────────────────────┐
│  👔 Manager Dashboard                               [Role: Manager] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Status Legend                                                    │
│  ─────────────                                                   │
│  [New] [Triaged] [Assigned] [In Progress] [Completed] [Closed]   │
│   Gray    Gray      Blue        Blue        Green      Green     │
│                                                                    │
│  Work Orders                                                      │
│  ────────────                                                    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ WO-2025-0001                    [New] [HIGH]               │  │
│  │ Bathroom sink leaking                                      │  │
│  │ Water dripping from under sink, creating puddle...         │  │
│  │                                                            │  │
│  │ [Triage] [Assign Technician ▼]                            │  │
│  │          • Mike Johnson                                    │  │
│  │          • Sarah Williams                                  │  │
│  │          • David Chen                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ WO-2025-0002                    [Assigned] [NORMAL]        │  │
│  │ Air conditioning not working                               │  │
│  │ Assigned to: Mike Johnson                                  │  │
│  │                                                            │  │
│  │ [Start Work] [Reassign]                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Work Order State Transitions:
```
     New ──────▶ Triaged ──────▶ Assigned
      │             │               │
      │             │               ▼
      │             │          In Progress
      │             │               │
      │             │               ▼
      │             └─────────▶ Completed
      │                            │
      └────────────────────────────▶ Closed
                                    │
                                    ▼
                                [Audit Verify]
```

## Step 3: Technician View - Complete Work

### After Assignment (Tech Perspective)

```
┌────────────────────────────────────────────────────────────────────┐
│  🔧 Technician Dashboard                              [Role: Tech]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  My Assigned Work Orders                                          │
│  ────────────────────────                                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ WO-2025-0001                    [Assigned] [HIGH]          │  │
│  │ Bathroom sink leaking                                      │  │
│  │ Unit: 101 | Tenant: John Smith                            │  │
│  │                                                            │  │
│  │ [Start Work] → Changes status to "In Progress"            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  After Starting Work:                                             │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ WO-2025-0001                    [In Progress] [HIGH]       │  │
│  │                                                            │  │
│  │ Completion Notes:                                          │  │
│  │ ┌──────────────────────────────────────┐                  │  │
│  │ │ Replaced P-trap seal                  │                  │  │
│  │ │ Tested for leaks - all good           │                  │  │
│  │ └──────────────────────────────────────┘                  │  │
│  │                                                            │  │
│  │ [Mark Complete]                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Step 4: Audit Verification

### Manager Clicks "Audit Verify"

```
┌────────────────────────────────────────────────────────────────────┐
│                      Audit Verification Modal                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Work Order: WO-2025-0001                                         │
│                                                                    │
│  ✅ Verification Status: VALID                                    │
│                                                                    │
│  🔒 Hash Preview: a1b2c3d4e5...                                  │
│                                                                    │
│  📅 Verified At: 2025-01-20 15:30:00                            │
│                                                                    │
│  ┌─────────────────────┐                                         │
│  │  View Audit Log     │ → Opens detailed audit trail           │
│  └─────────────────────┘                                         │
│                                                    [Close]        │
└────────────────────────────────────────────────────────────────────┘
```

### Audit Log Details (Opens in New Tab):
```
┌────────────────────────────────────────────────────────────────────┐
│  Audit Trail for Work Order WO-2025-0001                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Event Chain (Newest First):                                      │
│  ─────────────────────────                                       │
│                                                                    │
│  #5 │ 2025-01-20 15:25:00 │ STATUS_CHANGE     │ completed        │
│     │ Previous Hash: 4f5e6d...                                   │
│     │ Current Hash:  a1b2c3...                                   │
│     │ Actor: tech_005 (Mike Johnson)                             │
│                                                                    │
│  #4 │ 2025-01-20 15:20:00 │ STATUS_CHANGE     │ in_progress      │
│     │ Previous Hash: 9c8b7a...                                   │
│     │ Current Hash:  4f5e6d...                                   │
│     │ Actor: tech_005 (Mike Johnson)                             │
│                                                                    │
│  #3 │ 2025-01-20 15:15:00 │ TECH_ASSIGNED    │ Mike Johnson     │
│     │ Previous Hash: 2d3e4f...                                   │
│     │ Current Hash:  9c8b7a...                                   │
│     │ Actor: mgr_002 (Property Manager)                          │
│                                                                    │
│  #2 │ 2025-01-20 15:10:00 │ STATUS_CHANGE     │ triaged          │
│     │ Previous Hash: 1a2b3c...                                   │
│     │ Current Hash:  2d3e4f...                                   │
│     │ Actor: mgr_002 (Property Manager)                          │
│                                                                    │
│  #1 │ 2025-01-20 15:00:00 │ WORK_ORDER_CREATED │ new            │
│     │ Previous Hash: 000000...                                   │
│     │ Current Hash:  1a2b3c...                                   │
│     │ Actor: tenant_004 (John Smith)                             │
│                                                                    │
│  ✅ Hash Chain Integrity: VERIFIED                                │
│  🔒 Tamper Detection: NO MODIFICATIONS DETECTED                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 🎮 Interactive Features

### Role Switcher
```
┌─────────────────────────────────────────────┐
│  Current Role:  [Tenant] [Manager] [Tech]   │
│                    ▲        ○        ○       │
│                Selected                      │
└─────────────────────────────────────────────┘

Click to instantly switch perspectives!
Or use URL: ?as=tenant, ?as=manager, ?as=tech
```

### Status Chip Color Guide
```
┌──────────────────────────────────────────────────┐
│  Status         │ Color    │ Meaning            │
├─────────────────┼──────────┼────────────────────┤
│ New/Triaged     │ Gray     │ Awaiting action    │
│ Assigned        │ Blue     │ Active work        │
│ In Progress     │ Blue     │ Being worked on    │
│ Completed       │ Green    │ Work finished      │
│ Closed          │ Green    │ Fully resolved     │
│ Reopened        │ Gray     │ Needs attention    │
└──────────────────────────────────────────────────┘
```

## 📱 API Flow Sequence

```
Tenant Portal                    API Server                    Database
     │                               │                            │
     │──────── POST /photo ─────────▶│                            │
     │         (FormData)            │                            │
     │◀──────── photoKey ────────────│                            │
     │                               │                            │
     │──── POST /work-orders ────────▶                            │
     │     (with photoKey)           │──── INSERT work_order ────▶│
     │                               │                            │
     │                               │──── INSERT audit_log ─────▶│
     │                               │      (hash chain)          │
     │◀────── ticketId: WO-2025-0001─│◀────── success ───────────│
     │                               │                            │

Manager Dashboard                    │                            │
     │                               │                            │
     │──── GET /work-orders ─────────▶                            │
     │                               │──── SELECT * FROM... ─────▶│
     │◀────── work orders list ──────│◀────── results ───────────│
     │                               │                            │
     │──── POST /assign ─────────────▶                            │
     │                               │──── UPDATE work_order ────▶│
     │                               │──── INSERT audit_log ─────▶│
     │◀────── success ───────────────│◀────── success ───────────│
     │                               │                            │

Audit Verification                   │                            │
     │                               │                            │
     │──── GET /audit/verify ────────▶                            │
     │                               │──── Validate hash chain ──▶│
     │◀────── ✅ Valid ──────────────│◀────── chain validated ───│
     │                               │                            │
```

## 🧪 Testing the Flow

### Automated Test
```bash
# Run the complete flow automatically
node scripts/demo-workflow.js

# Output:
Creating work order as tenant...
✅ Created: WO-2025-0001

Assigning to technician as manager...
✅ Assigned to: Mike Johnson

Marking as complete as technician...
✅ Status: completed

Verifying audit trail...
✅ Audit chain valid: 5 events verified
```

### Manual Test Checklist
- [ ] Tenant can upload photo
- [ ] Ticket ID generated (WO-YYYY-####)
- [ ] Manager sees new work order
- [ ] Assignment changes status to "Assigned"
- [ ] Tech can start and complete work
- [ ] Audit verification shows valid chain
- [ ] Role switcher works correctly
- [ ] Status chips show correct colors

## 🎯 Key Demo Points

1. **Multi-Tenant Security**: Every request isolated by organization
2. **Audit Trail**: Immutable, cryptographic proof of all changes
3. **Role-Based Access**: Different views for different users
4. **Real-Time Updates**: Status changes reflect immediately
5. **Photo Evidence**: Direct upload with work orders
6. **Ticket System**: Professional ticketing with unique IDs

## 🚀 Advanced Demo Features

### Webhook Testing (Payments)
```bash
# Trigger a test payment webhook
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test" \
  -d '{"type":"checkout.session.completed","id":"evt_test_123"}'
```

### Performance Testing
```bash
# Run load test (creates 100 work orders)
npm run perf:load

# Monitor performance
docker stats
```

### Chaos Engineering
```bash
# Test resilience - restart Redis
npm run chaos:redis

# Test resilience - restart Postgres
npm run chaos:postgres
```

---

🎊 **Congratulations!** You've completed the full demo walkthrough. The system demonstrates enterprise-grade features in a local development environment.