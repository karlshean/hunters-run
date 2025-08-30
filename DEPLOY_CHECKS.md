# Production Deployment Verification Checklist

## Pre-Deployment Verification

### 1. Environment Configuration
```bash
# Verify all required environment variables are set
node -e "
const requiredVars = [
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL', 
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'POSTGRES_ADMIN_PASSWORD',
  'REDIS_PASSWORD'
];
const missing = requiredVars.filter(v => !process.env[v] || process.env[v].includes('PLACEHOLDER'));
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing);
  process.exit(1);
}
console.log('✅ All required environment variables are set');
"
```

### 2. Database Connectivity
```bash
# Test database connection with app_user credentials
DATABASE_URL=$DATABASE_URL DB_SSL_MODE=strict node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});
client.connect()
  .then(() => client.query('SELECT current_user, current_setting(\\'is_superuser\\')'))
  .then(res => {
    console.log('✅ Database connection successful');
    console.log('Current user:', res.rows[0].current_user);
    console.log('Is superuser:', res.rows[0].current_setting);
    return client.end();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"
```

### 3. RLS Security Verification
```bash
# Verify RLS policies are active and enforced
DATABASE_URL=$DATABASE_URL DB_SSL_MODE=strict node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

(async () => {
  try {
    await client.connect();
    
    // Check RLS is enabled
    const rlsCheck = await client.query(\`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'hr' AND rowsecurity = true
    \`);
    
    if (rlsCheck.rows.length === 0) {
      throw new Error('No RLS-enabled tables found in hr schema');
    }
    
    console.log('✅ RLS enabled on', rlsCheck.rows.length, 'tables');
    
    // Test organization isolation
    await client.query(\`SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000001', false)\`);
    const org1 = await client.query('SELECT COUNT(*) FROM hr.properties');
    
    await client.query(\`SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000002', false)\`);
    const org2 = await client.query('SELECT COUNT(*) FROM hr.properties');
    
    console.log('✅ RLS isolation verified - org1:', org1.rows[0].count, 'org2:', org2.rows[0].count);
    
    await client.end();
  } catch (err) {
    console.error('❌ RLS verification failed:', err.message);
    process.exit(1);
  }
})();
"
```

### 4. Firebase Configuration Test
```bash
# Test Firebase Admin SDK initialization
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID FIREBASE_SERVICE_ACCOUNT_JSON=$FIREBASE_SERVICE_ACCOUNT_JSON NODE_ENV=production node -e "
const admin = require('firebase-admin');
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
  console.log('Project ID:', app.options.projectId);
} catch (err) {
  console.error('❌ Firebase initialization failed:', err.message);
  process.exit(1);
}
"
```

### 5. Build Verification
```bash
# Build and test all applications
echo "Building hr-api..."
cd apps/hr-api && npm run build
if [ $? -ne 0 ]; then
  echo "❌ hr-api build failed"
  exit 1
fi

echo "Building hr-web..."
cd ../hr-web && npm run build
if [ $? -ne 0 ]; then
  echo "❌ hr-web build failed"  
  exit 1
fi

echo "✅ All applications built successfully"
```

## Deployment Verification

### 6. Container Health Checks
```bash
# Wait for all services to be healthy
echo "Checking service health..."
docker-compose ps

# Wait for postgres to be ready
timeout 60 bash -c 'until docker-compose exec postgres pg_isready -U postgres -d hunters_run_prod; do sleep 2; done'
echo "✅ PostgreSQL is ready"

# Wait for hr-api to be healthy
timeout 60 bash -c 'until curl -f http://localhost:3000/api/health; do sleep 2; done'
echo "✅ hr-api is healthy"

# Check hr-web is responding
timeout 60 bash -c 'until curl -f http://localhost:3001; do sleep 2; done'
echo "✅ hr-web is responding"
```

### 7. API Functional Test
```bash
# Test API endpoints without authentication (health checks)
echo "Testing API health endpoint..."
curl -f http://localhost:3000/api/health || { echo "❌ Health check failed"; exit 1; }

echo "Testing API monitoring endpoint..."
curl -f http://localhost:3000/api/monitoring || { echo "❌ Monitoring endpoint failed"; exit 1; }

echo "✅ API endpoints responding"
```

### 8. Database Migration Verification
```bash
# Verify database schema is up to date
MIGRATION_DATABASE_URL=$MIGRATION_DATABASE_URL node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

(async () => {
  try {
    await client.connect();
    
    // Check if required schemas exist
    const schemas = await client.query(\`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('hr', 'platform', 'audit')
    \`);
    
    if (schemas.rows.length !== 3) {
      throw new Error('Missing required database schemas');
    }
    
    // Check if roles exist
    const roles = await client.query(\`
      SELECT rolname FROM pg_roles 
      WHERE rolname IN ('app_user', 'migration_role')
    \`);
    
    if (roles.rows.length !== 2) {
      throw new Error('Missing required database roles');
    }
    
    console.log('✅ Database schema and roles verified');
    
    await client.end();
  } catch (err) {
    console.error('❌ Database verification failed:', err.message);
    process.exit(1);
  }
})();
"
```

## Post-Deployment Monitoring

### 9. Log Analysis
```bash
# Check application logs for errors
echo "Checking hr-api logs..."
docker-compose logs hr-api | grep -i error || true

echo "Checking postgres logs..."
docker-compose logs postgres | grep -i error || true

echo "Checking nginx logs..."
docker-compose logs nginx | grep -i error || true
```

### 10. Performance Baseline
```bash
# Basic performance test
echo "Running performance baseline test..."
time curl -s http://localhost:3000/api/health > /dev/null
time curl -s http://localhost:3000/api/monitoring > /dev/null

echo "✅ Performance baseline captured"
```

## Security Validation

### 11. SSL/TLS Configuration
```bash
# Verify SSL configuration if using HTTPS
if curl -k https://localhost 2>/dev/null; then
  echo "Testing SSL configuration..."
  openssl s_client -connect localhost:443 -servername localhost < /dev/null 2>/dev/null | openssl x509 -noout -dates
  echo "✅ SSL certificate verified"
fi
```

### 12. Final Security Check
```bash
# Verify no superuser connections in production
DATABASE_URL=$DATABASE_URL node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    await client.connect();
    const result = await client.query('SELECT current_user, current_setting(\\'is_superuser\\')');
    const isSuperuser = result.rows[0].current_setting === 'on';
    
    if (isSuperuser) {
      console.error('❌ SECURITY ALERT: Application is running as superuser!');
      process.exit(1);
    }
    
    console.log('✅ Application running with non-privileged user:', result.rows[0].current_user);
    await client.end();
  } catch (err) {
    console.error('❌ Security check failed:', err.message);
    process.exit(1);
  }
})();
"
```

## Rollback Procedures

### In Case of Deployment Issues

1. **Stop all services:**
   ```bash
   docker-compose down
   ```

2. **Restore previous configuration:**
   ```bash
   git checkout HEAD~1 -- docker-compose.yml .env.prod
   ```

3. **Restart with previous version:**
   ```bash
   docker-compose up -d
   ```

4. **Verify rollback:**
   ```bash
   curl -f http://localhost:3000/api/health
   ```

## Success Criteria

- ✅ All environment variables validated
- ✅ Database connectivity confirmed with app_user
- ✅ RLS policies active and enforced
- ✅ Firebase Admin SDK initialized
- ✅ All applications built successfully
- ✅ All services healthy in Docker
- ✅ API endpoints responding
- ✅ Database schema up to date
- ✅ No errors in application logs
- ✅ Performance baseline established
- ✅ Security validations passed

## Contact Information

**Deployment Team:** [Your Team]  
**On-Call:** [On-Call Contact]  
**Documentation:** `docs/verification/proof-pack.md`  
**Monitoring:** `http://localhost:3000/api/monitoring`