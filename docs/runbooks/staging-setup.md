# Staging Environment Setup Guide

**Version:** v1.0.0-stabilized  
**Updated:** 2025-08-29  
**Prerequisites:** Node.js 20+, PostgreSQL 15+, Git

---

## 🎯 Overview

This guide provides step-by-step instructions for setting up a staging environment for the Hunters Run HR API. The staging environment replicates production configuration while using separate databases and credentials for safe testing.

---

## 📋 Prerequisites Checklist

### Infrastructure Requirements
- [ ] **Staging Server/Container**: Linux/Windows server with Node.js 20+ 
- [ ] **Staging Database**: PostgreSQL 15+ instance (separate from production)
- [ ] **Firebase Staging Project**: Separate Firebase project for staging
- [ ] **AWS Staging Resources**: S3 bucket and IAM credentials for file uploads (optional)
- [ ] **Domain/Network**: Accessible staging URL or port configuration

### Required Access
- [ ] **Git Repository**: Access to clone the Hunters Run repository
- [ ] **Database Admin**: Ability to create staging database and roles
- [ ] **Firebase Console**: Admin access to create staging project
- [ ] **AWS Console**: Access to create staging S3 bucket (if photo flow enabled)

---

## 🗄️ Database Setup

### 1. Create Staging Database
```sql
-- Connect as PostgreSQL superuser
CREATE DATABASE hunters_run_staging;
CREATE USER app_user_staging WITH PASSWORD 'secure_staging_password_2025';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE hunters_run_staging TO app_user_staging;
GRANT USAGE ON SCHEMA public TO app_user_staging;
GRANT CREATE ON SCHEMA public TO app_user_staging;
```

### 2. Apply Database Migrations
```bash
# Set staging database URL
export DATABASE_URL="postgresql://app_user_staging:secure_staging_password_2025@staging-db-host:5432/hunters_run_staging"
export DB_SSL_MODE=relaxed

# Apply migrations
npm run migrate
```

### 3. Create Test Organizations
```sql
-- Connect to staging database as app_user_staging
INSERT INTO platform.organizations (id, name, created_at) VALUES 
  ('00000000-0000-4000-8000-000000000001', 'Demo Organization', NOW()),
  ('00000000-0000-4000-8000-000000000002', 'Staging Test Org', NOW());

-- Create test users and memberships as needed
INSERT INTO platform.users (id, external_sub, external_provider, email, created_at) VALUES
  ('10000000-0000-4000-8000-000000000001', 'staging-user-1', 'dev', 'staging1@example.com', NOW()),
  ('10000000-0000-4000-8000-000000000002', 'staging-user-2', 'dev', 'staging2@example.com', NOW());

INSERT INTO platform.memberships (user_id, organization_id, role_name) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'hr_admin'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'hr_admin');
```

### 4. Add Sample Data
```sql
-- Add some properties for testing
INSERT INTO hr.properties (id, organization_id, name, address, created_at) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', 'Staging Property 1', '123 Test St, Staging City', NOW()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', 'Staging Property 2', '456 Demo Ave, Test Town', NOW()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000002', 'Test Org Property', '789 Staging Blvd, Demo City', NOW());

-- Add work orders for testing  
INSERT INTO hr.work_orders (id, organization_id, title, status, priority, ticket_number, created_at) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', 'Fix HVAC System', 'open', 'high', 'STG-001', NOW()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', 'Repair Main Door', 'in_progress', 'medium', 'STG-002', NOW()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000002', 'Clean Staging Area', 'open', 'low', 'TST-001', NOW());
```

---

## 🔥 Firebase Staging Project Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" 
3. Project name: `hunters-run-staging` (or similar)
4. Enable Google Analytics if desired
5. Create project

### 2. Enable Authentication
1. Navigate to **Authentication** → **Sign-in method**
2. Enable desired providers (Email/Password, Google, etc.)
3. Add staging domain to authorized domains if needed

### 3. Create Service Account
1. Go to **Project Settings** → **Service Accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Extract the following values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`  
   - `private_key` → `FIREBASE_PRIVATE_KEY`

### 4. Test Firebase Connection
```bash
# Use the firebase-admin-verify script
FIREBASE_PROJECT_ID=your-staging-project \
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-***@staging-project.iam.gserviceaccount.com \
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" \
node scripts/firebase-admin-verify.js
```

---

## ☁️ AWS Staging Setup (Optional)

### 1. Create S3 Bucket
```bash
aws s3 mb s3://hunters-run-staging-photos --region us-east-2
```

### 2. Create IAM User
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject", 
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::hunters-run-staging-photos/*"
    }
  ]
}
```

### 3. Get Credentials
- Create IAM user: `hunters-run-staging`
- Attach the policy above
- Generate access key and secret key

---

## 🚀 Application Deployment

### 1. Clone Repository
```bash
git clone <repository-url>
cd hunters-run
git checkout v1.0.0-stabilized
```

### 2. Install Dependencies
```bash
npm ci
```

### 3. Create Staging Environment File
```bash
# Copy the template
cp apps/hr-api/.env.staging.example apps/hr-api/.env.staging

# Edit with real values (DO NOT COMMIT)
nano apps/hr-api/.env.staging
```

Example staging environment:
```bash
# Database
DATABASE_URL=postgresql://app_user_staging:secure_staging_password_2025@staging-db-host:5432/hunters_run_staging
DB_SSL_MODE=relaxed

# Firebase  
FIREBASE_PROJECT_ID=hunters-run-staging-abc123
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xyz@hunters-run-staging-abc123.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...REAL_KEY_HERE...II=\n-----END PRIVATE KEY-----"

# AWS (optional)
AWS_REGION=us-east-2
AWS_S3_BUCKET=hunters-run-staging-photos
AWS_ACCESS_KEY_ID=AKIA...STAGING_KEY
AWS_SECRET_ACCESS_KEY=real_secret_key_here

# Features
TENANT_PHOTO_FLOW_ENABLED=true
NODE_ENV=staging
PORT=3000
```

### 4. Build Application
```bash
cd apps/hr-api
npm run build
```

### 5. Deploy Using Scripts

**Option A: Automated deployment with validation**
```bash
node tools/deploy/staging/deploy.js
```

**Option B: Manual start/restart**
```bash
# Linux/Mac
bash tools/deploy/staging/restart.sh

# Windows  
tools\deploy\staging\restart.bat
```

---

## 🏥 Health Check & Validation

### 1. Basic Health Check
```bash
curl http://staging-host:3000/api/health
# Expected: {"ok":true,"timestamp":"2025-08-29T..."}
```

### 2. Authentication Test
```bash
curl -H "Authorization: Bearer dev-token" \
     -H "x-org-id: 00000000-0000-4000-8000-000000000001" \
     http://staging-host:3000/api/properties
# Expected: {"success":true,"properties":[...],"count":N}
```

### 3. Work Orders Test
```bash
curl -H "Authorization: Bearer dev-token" \
     -H "x-org-id: 00000000-0000-4000-8000-000000000001" \
     http://staging-host:3000/api/work-orders  
# Expected: {"success":true,"items":[...],"count":N,"meta":{...}}
```

### 4. Cross-Organization Security Test
```bash
# Should return 0 items (different org)
curl -H "Authorization: Bearer dev-token" \
     -H "x-org-id: 00000000-0000-4000-8000-000000000002" \
     http://staging-host:3000/api/properties
```

---

## 📊 Monitoring & Maintenance

### Log Locations
- **Application Logs**: `apps/hr-api/staging.log`
- **Database Logs**: PostgreSQL instance logs  
- **System Logs**: `/var/log/` (Linux) or Event Viewer (Windows)

### Key Metrics to Monitor
- **Health endpoint response time**: Should be < 500ms
- **Database connection count**: Monitor for connection leaks
- **Memory usage**: Node.js process memory consumption
- **Error rates**: Watch for authentication or RLS failures

### Regular Maintenance
```bash
# Weekly dependency check
node scripts/dependency-audit.js

# Monthly security scan
node scripts/ci-guardrails.js

# Database maintenance (as needed)
VACUUM ANALYZE; -- Run on staging database
```

---

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Failures
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check RLS policies
psql $DATABASE_URL -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'hr'"
```

#### Firebase Authentication Errors  
```bash
# Verify Firebase configuration
node scripts/firebase-admin-verify.js

# Check project ID matches
echo $FIREBASE_PROJECT_ID
```

#### Missing Environment Variables
```bash
# Validate all required variables are set
node scripts/detect-env-path.js
```

#### RLS/Authorization Issues
```bash
# Test RLS enforcement
node scripts/simple-app-user-probe.js

# Check organization membership
psql $DATABASE_URL -c "SELECT * FROM platform.memberships WHERE user_id IN (SELECT id FROM platform.users WHERE external_sub = 'staging-user-1')"
```

### Emergency Contacts
- **Infrastructure**: System administrator 
- **Database**: Database administrator
- **Firebase**: Firebase project owner
- **AWS**: AWS account administrator

---

## 🔒 Security Considerations

### Secrets Management
- **Never commit** `.env.staging` to version control
- Use environment variables or secret management system
- Rotate staging credentials regularly (quarterly)
- Keep staging data separate from production

### Network Security
- Restrict staging database access to application servers only
- Use VPC/firewall rules to limit external access
- Enable HTTPS for staging URLs if externally accessible
- Monitor for unauthorized access attempts

### Data Privacy
- Use synthetic/anonymized test data when possible
- No real user PII in staging environment  
- Regular data cleanup to prevent accumulation
- Separate Firebase projects prevent cross-contamination

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Database created and migrations applied
- [ ] Firebase staging project configured
- [ ] AWS staging resources created (if needed)
- [ ] Environment file populated with real values
- [ ] Application built successfully
- [ ] CI guardrails passing

### Post-Deployment  
- [ ] Health check returns 200 OK
- [ ] Authentication endpoint accessible
- [ ] Properties API returns organization-scoped data
- [ ] Work Orders API returns organization-scoped data
- [ ] Cross-organization security test blocks access
- [ ] Logs show no critical errors
- [ ] Monitoring configured and operational

### Sign-off
- [ ] Technical lead approval
- [ ] Security review completed
- [ ] Performance baseline established  
- [ ] Monitoring and alerting configured
- [ ] Runbook documentation updated

---

*Staging environment setup complete. Ready for safe testing and validation of new features before production deployment.* 🚀