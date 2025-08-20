# Demo Flow Screencast Script

**Demo: Hunters Run Maintenance Flow** 
*Version: 1.0*  
*Target Duration: 3-4 minutes*

## Pre-Demo Setup Checklist
- [ ] Database seeded with demo data (`npm run seed`)
- [ ] Seed validation passed (`npm run ceo:seed-check`)  
- [ ] Both services running (`npm run dev:all`)
- [ ] Browser cleared of cache/localStorage

---

## Script Timeline

### 0:00-0:20 | Introduction & Setup
**[Screen: Terminal showing setup commands]**
```bash
# Validate seed data
npm run ceo:seed-check
✅ All seed data validation checks passed!

# Start demo environment  
npm run dev:all
```

**[Voiceover]**: "Today we'll demo the complete maintenance workflow in Hunters Run - from tenant photo submission to manager assignment and audit verification."

### 0:20-0:45 | Tenant Flow - Photo Upload
**[Screen: Navigate to localhost:5173/tenant]**

- **Action**: Select file using photo input
- **Action**: Fill in form:
  - Title: "Bathroom sink leaking"
  - Description: "Water dripping from under sink, making puddle on floor"
- **Action**: Click "Submit Work Order"

**[Voiceover]**: "As a tenant, I can easily report maintenance issues with photo evidence. The system generates unique ticket IDs in WO-YYYY-#### format."

**[Show success message with ticket ID: WO-2025-0001]**

### 0:45-1:20 | Manager Flow - Assignment & Status
**[Screen: Switch to localhost:5173/manager or use RoleSwitcher]**

- **Action**: Use RoleSwitcher component to switch to Manager role  
- **Action**: View work order list showing:
  - Ticket ID: WO-2025-0001
  - Status chip: "New" (neutral gray)
  - Title: "Bathroom sink leaking"
- **Action**: Click work order to view details
- **Action**: Assign to technician: "Mike Johnson"
- **Action**: Status changes to "Assigned" (blue info chip)

**[Voiceover]**: "Managers can view all work orders with consistent status chips, assign technicians, and track progress in real-time."

### 1:20-1:50 | Technician Flow - Work Completion  
**[Screen: Switch to technician view]**

- **Action**: Use RoleSwitcher to switch to Tech role
- **Action**: View assigned work orders
- **Action**: Update status to "In Progress" (blue info chip)
- **Action**: Add completion notes: "Replaced P-trap seal, tested for leaks"
- **Action**: Mark as "Completed" (green success chip)

**[Voiceover]**: "Technicians can update work progress, add completion notes, and mark work orders as complete."

### 1:50-2:30 | Audit Verification Flow
**[Screen: Back to manager view]**

- **Action**: Switch back to Manager role  
- **Action**: View completed work order (WO-2025-0001)
- **Action**: Click "Audit Verify" button
- **Action**: AuditVerifyModal opens showing:
  - ✅ Verification status
  - Hash preview: "a1b2c3d4e5..."
  - "View audit log" link
- **Action**: Click "View audit log" (opens new tab)
- **Action**: Show audit trail with all status changes

**[Voiceover]**: "Every action is cryptographically verified with audit hashes. Managers can validate the complete workflow integrity and view detailed audit logs."

### 2:30-3:00 | Status Overview & Polish Demo
**[Screen: Navigate between different views]**

- **Action**: Demonstrate status chip color consistency:
  - New/Triaged: Gray (neutral)
  - Assigned/In Progress: Blue (info)  
  - Completed/Closed: Green (success)
- **Action**: Show modal animations and hover effects
- **Action**: Test role switching with URL parameters: `?as=tenant`, `?as=manager`

**[Voiceover]**: "The system provides consistent UX with color-coded status chips, smooth animations, and flexible role switching for comprehensive testing."

### 3:00-3:30 | Technical Validation
**[Screen: Terminal showing validation commands]**

```bash
# Run end-to-end tests
npm run test:e2e
✅ All tests passing

# Photo upload smoke test  
npm run -w apps/hr-web test
✅ Photo upload smoke test passed

# Seed data validation
npm run ceo:seed-check  
✅ Database ready for demo
```

**[Voiceover]**: "The demo includes comprehensive testing with photo upload smoke tests, end-to-end validation, and automated seed data verification."

---

## Key Demo Highlights

1. **Complete Workflow**: Tenant → Photo → Manager → Tech → Audit  
2. **Ticket ID System**: WO-YYYY-#### format with unique generation
3. **Status Chips**: Consistent color coding (neutral/info/success)
4. **Audit Verification**: Cryptographic hash validation with drill-down
5. **Role Switching**: URL params + localStorage fallback  
6. **Photo Upload**: Multi-part FormData with validation
7. **Animations**: Modal fade/scale, hover effects, transitions
8. **Testing**: Comprehensive smoke tests and validation scripts

## Demo URLs
- **Tenant**: `http://localhost:5173/tenant`
- **Manager**: `http://localhost:5173/manager`  
- **Technician**: `http://localhost:5173/tech`
- **Role Switch**: Add `?as=tenant|manager|tech` to any URL

## Troubleshooting
- **Seed Issues**: Run `npm run ceo:seed-check` for validation
- **Service Down**: Verify `npm run dev:all` is running
- **Photo Upload**: Check browser console for FormData errors
- **Audit Modal**: Ensure API endpoints return mock data

---
*Last Updated: 2025-01-20*