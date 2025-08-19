# Pull Request

## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Phase 2.5 Verification Checklist

### 🔧 Core Implementation
- [ ] Work order CRUD operations with DTO validation
- [ ] Status machine enforcement (422 for illegal transitions)
- [ ] Multi-tenant RLS policies active on all tables
- [ ] SHA256 audit hash chain implementation
- [ ] Deterministic seed data with fixed UUIDs

### 🧪 Testing Coverage
- [ ] Unit tests pass (`npm run test:hr`)
- [ ] E2E tests cover all negative cases (`npm run test:hr:e2e`)
- [ ] RLS snapshot test validates policy drift (`npm run test:rls`)
- [ ] Smoke tests verify complete workflow (`node scripts/smoke.js`)

### 🚀 Automation & Artifacts
- [ ] CI workflow runs successfully
- [ ] OpenAPI spec generates without errors (`npm run openapi:generate`)
- [ ] Postman collection includes all endpoints + negative cases
- [ ] All verification scripts complete successfully

### 🛡️ Security & Data Integrity
- [ ] Organization isolation enforced (x-org-id header required)
- [ ] Audit chain validation endpoint returns valid=true
- [ ] No data leakage between organizations
- [ ] All sensitive operations require proper authentication

### 📋 Documentation
- [ ] README includes one-button verification steps
- [ ] All scripts have clear error messages
- [ ] Code follows established patterns and conventions

## Testing Instructions
```bash
# Quick verification
npm ci
docker compose up -d
npm run migrate
npm run seed:local
npm run dev:hr

# Run full test suite
npm run test:hr
npm run test:hr:e2e
node scripts/smoke.js
```

## Proof of Functionality
Please attach screenshots or copy/paste output from:
- [ ] Smoke test output showing all ✅ passed
- [ ] E2E test results
- [ ] Audit validation endpoint response

## Additional Notes
Any additional context, concerns, or explanations for reviewers.