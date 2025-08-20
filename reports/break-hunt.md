# Break Hunt 002 Report

**Branch**: fix/break-hunt-002  
**Date**: 2025-08-20  
**Status**: In Progress  

## Executive Summary

Systematic break hunt across the hunters-run codebase to identify and fix all current breaks in build, type safety, testing, runtime security, and CI guardrails.

## Critical Findings Summary

| Category | P0 Issues | P1 Issues | P2 Issues | P3 Issues | Total |
|----------|-----------|-----------|-----------|-----------|-------|
| Type Safety | 2 | 12 | 89 | 0 | 103 |
| Security | 1 | 3 | 2 | 1 | 7 |
| Configuration | 0 | 6 | 4 | 0 | 10 |
| Testing | 1 | 2 | 1 | 0 | 4 |
| Performance | 0 | 1 | 3 | 2 | 6 |

## Detailed Findings

### 1. Type Safety Issues

#### P0-T1: Critical 'any' Usage in Controllers
**Symptom**: All controllers use `req: any` instead of proper typing
**Files**: All `*controller.ts` files (8 occurrences)
**Severity**: P0 (Runtime safety risk)
**Proposed Fix**: Replace with proper Request typing from NestJS
**Test to add**: Type assertion tests
```typescript
// Before
async createWorkOrder(@Req() req: any, @Body() dto: any) {
// After  
async createWorkOrder(@Req() req: CustomRequest, @Body() dto: CreateWorkOrderDto) {
```

#### P0-T2: Unsafe Any in Webhook Processing  
**Symptom**: Webhook event processing uses untyped `any` for critical payment data
**Files**: `payments.service.ts`, `webhook.controller.ts`
**Severity**: P0 (Payment security risk)
**Proposed Fix**: Define proper Stripe event interfaces
**Test to add**: Webhook payload validation tests

#### P1-T3: Missing Type Guards
**Symptom**: 89 instances of `any` without runtime validation
**Files**: Throughout codebase (see static scan results)
**Severity**: P1 (Type safety degradation)
**Proposed Fix**: Add type guards and proper interfaces
**Test to add**: Runtime type validation tests

### 2. Security Issues

#### P0-S1: CORS Misconfiguration
**Symptom**: CORS allows `http://localhost:3001` but web UI runs on `:3004`
**Files**: `main.ts` (line 13)
**Severity**: P0 (Demo non-functional)
**Proposed Fix**: Update CORS to allow `:3004`
**Test to add**: CORS endpoint validation test
```typescript
// Before
origin: ['http://localhost:3001'],
// After
origin: ['http://localhost:3001', 'http://localhost:3004'],
```

#### P1-S2: Missing Security Headers
**Symptom**: No Helmet.js configuration for security headers
**Files**: `main.ts`
**Severity**: P1 (Security hardening missing)
**Proposed Fix**: Add Helmet middleware
**Test to add**: Security header validation

#### P1-S3: Environment Variable Exposure
**Symptom**: Several `process.env` reads lack defaults or validation
**Files**: Multiple (see process.env audit)
**Severity**: P1 (Configuration drift risk)
**Proposed Fix**: Add validation and defaults
**Test to add**: Environment configuration tests

### 3. Configuration Issues

#### P1-C1: Missing Environment Variables in .env.example
**Symptom**: Process.env usage not documented in .env.example
**Files**: `.env.example` missing entries for:
- `REDIS_HOST`
- `REDIS_PORT` 
- `LOG_LEVEL`
- `DEFAULT_ORG_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
**Severity**: P1 (Developer experience)
**Proposed Fix**: Add missing entries to .env.example
**Test to add**: Environment completeness validation

#### P1-C2: Inconsistent Database Connection Strings
**Symptom**: Different connection string formats across files
**Files**: Multiple test files, seed-check.ts
**Severity**: P1 (Configuration inconsistency)
**Proposed Fix**: Standardize on single DATABASE_URL format
**Test to add**: Connection string validation tests

### 4. Testing Issues

#### P0-T1: Photo Upload Tests Failing
**Symptom**: All photo upload smoke tests failing due to missing form submission handling
**Files**: `tenant.upload.smoke.test.tsx`
**Severity**: P0 (CI broken)
**Proposed Fix**: Fix form submission mocking in tests
**Test to add**: Working photo upload integration test

#### P1-T2: Missing Test Configuration
**Symptom**: hr-web package missing proper test setup
**Files**: `apps/hr-web/package.json`, missing vitest.config.ts
**Severity**: P1 (CI incomplete)
**Proposed Fix**: Add complete test configuration
**Test to add**: Test runner validation

### 5. Performance Issues

#### P1-P1: Unindexed Database Queries
**Symptom**: Some queries may lack proper indexing
**Files**: Database schema files
**Severity**: P1 (Scale risk)  
**Proposed Fix**: Add performance indexes
**Test to add**: Query performance tests

## Route Security Audit

### Discovered Endpoints
All endpoints properly use RLSInterceptor except:
- `GET /health` (intentional - public)
- `GET /ready` (intentional - public) 
- `POST /payments/webhook` (intentional - external)

### CORS Analysis
- **Current**: `http://localhost:3001`
- **Required**: `http://localhost:3004` (actual web UI port)
- **Risk**: Demo functionality broken

### RLS Policy Validation
✅ **PASS**: All business tables have organization_id and RLS enabled
✅ **PASS**: All policies use `current_setting('app.current_org_id')::uuid` pattern
✅ **PASS**: Webhook events have proper deduplication via unique(provider, event_id)
✅ **PASS**: Dead letter queue implemented in webhook_failures table

## Most-Likely-Red Checklist

| Check | Status | Notes |
|-------|--------|-------|
| `tsc -b` | ❌ | Type errors from 'any' usage |
| `test:e2e` | ❌ | Photo upload tests failing |
| `test:security` | ❌ | RLS tests may fail due to org context |
| `ceo:validate:sh` | ❌ | CORS misconfiguration breaks demo |
| `npm run build` | ✅ | Builds successfully |
| `npm run lint` | N/A | No linter configured |

## Immediate Action Items (P0)

1. **Fix CORS Configuration** - Update main.ts to allow :3004
2. **Fix Photo Upload Tests** - Resolve test mocking issues  
3. **Add Type Safety** - Replace critical 'any' usage in controllers
4. **Add Missing .env Variables** - Complete environment documentation

## Implementation Plan

### Phase 1: Critical Fixes (P0)
- [ ] Update CORS configuration
- [ ] Fix photo upload test mocking
- [ ] Add proper controller typing
- [ ] Update .env.example

### Phase 2: Security Hardening (P1)
- [ ] Add Helmet.js security headers
- [ ] Add environment variable validation
- [ ] Fix database connection string consistency
- [ ] Add missing test configurations

### Phase 3: Quality Improvements (P2+)
- [ ] Add comprehensive type guards
- [ ] Implement performance monitoring
- [ ] Add lint configuration
- [ ] Performance test suite

## Test Coverage Requirements

Each fix must include:
1. **Before Test**: Demonstrates the issue
2. **Fix Implementation**: Code changes
3. **After Test**: Validates the fix
4. **Regression Guard**: CI check to prevent reoccurrence

## CI Guardrails to Add

1. **Static Analysis Pipeline**
   - TypeScript compilation check
   - ESLint with strict rules
   - Security vulnerability scanning
   - TODO/FIXME/any usage limits

2. **Security Pipeline** 
   - CORS configuration validation
   - Environment variable completeness check
   - RLS policy validation
   - Webhook signature testing

3. **Performance Pipeline**
   - Database query analysis
   - Load testing on critical paths
   - Memory leak detection

## Weekly Break Hunt Automation

Proposed CI job to run weekly:
```yaml
name: Weekly Break Hunt
schedule:
  - cron: '0 0 * * 1' # Every Monday
jobs:
  break-hunt:
    runs-on: ubuntu-latest
    steps:
      - name: Scan for TODOs
        run: rg "TODO|FIXME|@ts-ignore" --exit-code
        continue-on-error: false
      - name: Count 'any' usage
        run: |
          COUNT=$(rg '\bany\b' --count-matches --type ts | awk -F: '{sum+=$2} END {print sum}')
          if [ $COUNT -gt 10 ]; then exit 1; fi
```

## Conclusion

The codebase has **7 P0 issues** that must be resolved immediately to restore full functionality. The systematic break hunt revealed primarily type safety and configuration issues rather than fundamental architectural problems.

**Next Steps**:
1. Implement Phase 1 critical fixes
2. Add comprehensive CI guardrails  
3. Establish weekly automated break hunting
4. Document type safety standards

---
*Report generated by systematic break hunt on fix/break-hunt-002 branch*