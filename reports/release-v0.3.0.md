# Release v0.3.0 - Photo-First Maintenance Requests

**Release Date:** TBD  
**Branch:** `feature/photo-first-production` → `main`  
**Risk Level:** MEDIUM (new database schema, S3 integration)  
**Rollback Complexity:** HIGH (data migration required)  

## 🎯 Features Added

### Photo-First Tenant Experience
- **Frontend:** New `/tenant/report` page with camera-first capture
- **Mobile-optimized** with getUserMedia + file input fallback
- **Client-side compression** to ≤2MB using HTML5 Canvas
- **Success screen** with ticket ID + "Photo attached ✅" confirmation

### Backend Photo Pipeline
- **Presigned S3 uploads** via `POST /api/files/presign-photo`
- **Atomic photo validation** prevents orphaned uploads
- **Photo metadata storage** in work_orders table
- **Audit trail integration** includes photo evidence
- **Demo organization support** with mock S3 for testing

### Safety & Rollback Features
- **Archive table** `hr.work_order_photos_archive` preserves all photo data
- **Environment-controlled rollback** via `TENANT_PHOTO_FLOW_ENABLED=false`
- **Database triggers** prevent photo field changes when disabled
- **Backup scripts** for complete photo evidence preservation
- **Restore functions** for post-rollback data recovery

## 📊 Database Schema Changes

### New Tables
```sql
-- Photo archive for rollback safety
hr.work_order_photos_archive (
  id uuid PRIMARY KEY,
  work_order_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  tenant_photo_url text,
  tenant_photo_s3_key text,
  tenant_photo_uploaded_at timestamptz,
  tenant_photo_size_bytes integer,
  tenant_photo_mime_type text,
  tenant_photo_etag text,
  archived_at timestamptz NOT NULL,
  archived_reason text NOT NULL,
  source_table text NOT NULL
);

-- Photo upload token management
hr.photo_upload_tokens (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  s3_key text NOT NULL,
  expires_at timestamptz NOT NULL
);
```

### Modified Tables  
```sql
-- Extended work_orders with photo fields
ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_url text;
ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_s3_key text;
ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_uploaded_at timestamptz;
ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_size_bytes integer;
ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_mime_type text;
ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_etag text;
```

### New Functions & Triggers
- `hr.snapshot_work_order_photos()` - Archive existing photo data
- `hr.is_tenant_photo_flow_enabled()` - Check environment flag
- `hr.prevent_photo_changes_when_disabled()` - Trigger function
- `hr.restore_photos_from_archive()` - Restore archived photos

## 🚀 Deployment Steps

### 1. Pre-Deployment Backup
```bash
# Backup existing data before deployment
cd /path/to/hunters-run
./scripts/backup-photos.ps1 -Verbose

# Verify backup was created
ls -la backups/photo-backup-*
```

### 2. Database Migration
```bash
# Run migrations (includes photo schema + safety features)
npm run migrate

# Take snapshot of any existing photo data
npm run db:photo:snapshot

# Verify migration success
psql $DATABASE_URL -c "SELECT COUNT(*) FROM hr.work_order_photos_archive;"
```

### 3. Environment Configuration
```bash
# Add to production .env (S3 required for production)
AWS_S3_BUCKET=hunters-run-photos-prod
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxx...

# Optional: Start with photo flow disabled for gradual rollout
TENANT_PHOTO_FLOW_ENABLED=false
```

### 4. Application Deployment
```bash
# Build and deploy application
npm run build:hr
npm run build:web

# Deploy to production environment
# (deployment process varies by platform)
```

### 5. Post-Deployment Verification
```bash
# Test photo presign endpoint
curl -X POST https://api.hunters-run.com/api/files/presign-photo \
  -H "x-org-id: your-org-id" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","fileSize":1024,"mimeType":"image/jpeg"}'

# Test tenant photo page
# Navigate to: https://app.hunters-run.com/tenant/report

# Run CEO validation (should include photo step)
./scripts/ceo-validate.ps1
```

## 🔄 Rollback Runbook

### Emergency Rollback (Data-Safe)

#### Phase 1: Immediate Rollback (5 minutes)
```bash
# 1. Disable photo features immediately
export TENANT_PHOTO_FLOW_ENABLED=false
# OR set in production environment config

# 2. Restart application to apply environment change
systemctl restart hunters-run-api
# OR equivalent for your deployment platform

# 3. Verify photo updates are blocked
psql $DATABASE_URL -c "
UPDATE hr.work_orders 
SET tenant_photo_s3_key = 'test-blocked' 
WHERE id = (SELECT id FROM hr.work_orders LIMIT 1);"
# Should fail with: "Photo field updates are disabled"
```

#### Phase 2: Application Rollback (15 minutes)
```bash
# 1. Revert to previous application version
git checkout v0.2.x
npm run build:hr
npm run build:web
# Deploy previous version

# 2. Verify application is stable
curl https://api.hunters-run.com/api/health
```

#### Phase 3: Schema Rollback (30 minutes) - OPTIONAL
⚠️ **WARNING:** Only perform if absolutely necessary. All photo evidence will be preserved in archive table.

```bash
# 1. BEFORE rolling back schema, ensure archive is populated
npm run db:photo:snapshot

# 2. Backup all photo data (mandatory)
./scripts/backup-photos.ps1 -NoCompress -Verbose

# 3. Remove photo columns (DANGEROUS - photo data moves to archive)
psql $DATABASE_URL -c "
-- Remove photo columns from work_orders
ALTER TABLE hr.work_orders DROP COLUMN IF EXISTS tenant_photo_url;
ALTER TABLE hr.work_orders DROP COLUMN IF EXISTS tenant_photo_s3_key;
ALTER TABLE hr.work_orders DROP COLUMN IF EXISTS tenant_photo_uploaded_at;
ALTER TABLE hr.work_orders DROP COLUMN IF EXISTS tenant_photo_size_bytes;
ALTER TABLE hr.work_orders DROP COLUMN IF EXISTS tenant_photo_mime_type;
ALTER TABLE hr.work_orders DROP COLUMN IF EXISTS tenant_photo_etag;
"

# 4. Keep archive table for data recovery
# DO NOT DROP hr.work_order_photos_archive - contains all photo evidence!
```

### Data Recovery After Rollback

#### Restore Photo Data
```bash
# 1. View archived photo data
psql $DATABASE_URL -c "
SELECT work_order_id, tenant_photo_s3_key, archived_at, archived_reason
FROM hr.work_order_photos_archive 
ORDER BY archived_at DESC LIMIT 10;"

# 2. Restore specific work order photos
psql $DATABASE_URL -c "
SELECT hr.restore_photos_from_archive('work-order-uuid-here');"

# 3. Restore all photos archived after specific date
psql $DATABASE_URL -c "
SELECT hr.restore_photos_from_archive(NULL, '2024-01-01T00:00:00Z');"

# 4. Use backup files if needed
# Restore from: backups/photo-backup-[timestamp]-restore.sql
```

#### Query Photo Evidence (Always Available)
```sql
-- View work orders with photo history (rollback-safe)
SELECT * FROM hr.work_orders_with_photo_history 
WHERE has_archived_photos = true;

-- Direct access to archived photos
SELECT 
  wopa.work_order_id,
  wo.ticket_id,
  wo.title,
  wopa.tenant_photo_s3_key,
  wopa.archived_at,
  wopa.archived_reason
FROM hr.work_order_photos_archive wopa
JOIN hr.work_orders wo ON wo.id = wopa.work_order_id
ORDER BY wopa.archived_at DESC;
```

## 🔍 Rollback Testing

### Test Environment Rollback
```bash
# 1. Deploy v0.3.0 to staging
# 2. Create test work orders with photos
# 3. Take photo snapshot
# 4. Disable photo flow
# 5. Verify photo updates blocked
# 6. Rollback application
# 7. Verify data accessible via archive table
# 8. Test data restore function
```

### Production Rollback Checklist
- [ ] Photo backup completed and verified
- [ ] Archive table populated with all photo data
- [ ] `TENANT_PHOTO_FLOW_ENABLED=false` applied
- [ ] Application restarted and photo updates blocked
- [ ] Previous application version deployed
- [ ] Health checks passing
- [ ] Customer support team notified
- [ ] Photo evidence accessible via archive queries
- [ ] Data restore tested in staging environment

## 💡 Rollback Decision Matrix

| Scenario | Recommended Action | Data Risk | Downtime |
|----------|-------------------|-----------|----------|
| Performance issues | Phase 1: Disable feature only | None | 2-5 min |
| Photo upload errors | Phase 1 + 2: App rollback | None | 10-15 min |
| Database corruption | Phase 1-3: Full rollback | Low* | 30-45 min |
| S3 service failure | Phase 1: Disable feature | None | 2-5 min |

*Low risk because archive table preserves all photo evidence

## 🛡️ Safety Guarantees

### Photo Evidence Preservation
1. **Archive table** automatically created during migration
2. **Snapshot function** preserves all existing photo data  
3. **Trigger protection** prevents accidental data loss
4. **Backup scripts** create portable data exports
5. **Restore functions** enable complete data recovery

### Zero Evidence Loss Promise
- All photo evidence is preserved in `hr.work_order_photos_archive`
- Even in worst-case full schema rollback, evidence remains accessible
- Backup files provide additional recovery layer
- Restore functions enable complete data recovery to work_orders table

## 📋 Post-Rollback Actions

### Immediate (within 1 hour)
- [ ] Verify all work orders accessible
- [ ] Confirm photo evidence viewable via archive table
- [ ] Test maintenance request creation (non-photo)
- [ ] Notify stakeholders of rollback completion

### Short-term (within 24 hours)  
- [ ] Analyze rollback root cause
- [ ] Plan photo feature fixes if applicable
- [ ] Update customer communications
- [ ] Review monitoring alerts

### Long-term (within 1 week)
- [ ] Assess photo feature re-deployment strategy
- [ ] Update rollback procedures based on lessons learned
- [ ] Consider gradual feature rollout approach
- [ ] Plan photo evidence data re-integration

## ⚡ Emergency Contacts

**Database Issues:**
- DBA Team: [contact-info]
- Migration Specialist: [contact-info]

**Application Issues:**
- Development Team: [contact-info]  
- DevOps Team: [contact-info]

**Business Stakeholders:**
- Product Owner: [contact-info]
- Customer Success: [contact-info]

## 📈 Metrics to Monitor

### During Rollback
- Database connection count
- API response times
- Error rates in logs
- Work order creation success rate

### Post-Rollback  
- Customer satisfaction scores
- Support ticket volume
- Photo evidence access requests
- System performance baselines

---

**Document Owner:** Development Team  
**Last Updated:** [Current Date]  
**Next Review:** Post-rollback + 30 days