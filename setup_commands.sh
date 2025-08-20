# INSTALLATION AND RUN COMMANDS

## Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

## Quick Setup (All-in-One)
```bash
# Clone and setup entire project
git clone <repo-url> hunters-run-platform
cd hunters-run-platform

# Copy environment file and configure
cp .env.example .env
# Edit .env with your actual credentials

# Complete setup (install deps, start infra, migrate, seed)
npm run setup
```

## Manual Setup (Step by Step)
```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure (Postgres + Redis)
npm run docker:up

# 3. Wait for services to be ready, then migrate
sleep 15
npm run db:migrate

# 4. Seed test data
npm run db:seed

# 5. Start development servers
npm run dev
```

## Development Commands
```bash
# Start all services in development mode
npm run dev

# Start only API
cd apps/api && npm run start:dev

# Start only worker
cd apps/worker && npm run start:dev

# Build all packages
npm run build

# Run linting
npm run lint

# Format code
npm run format
```

## Database Operations
```bash
# Run migrations
npm run db:migrate

# Create new migration
cd apps/api && npm run typeorm:create -- src/database/migrations/NewMigration

# Generate migration from entity changes
cd apps/api && npm run typeorm:generate -- src/database/migrations/UpdatedEntities

# Seed database with test data
npm run db:seed

# Reset database (WARNING: destroys all data)
npm run docker:reset
```

## Testing
```bash
# Run all tests
npm run test

# Run API unit tests
cd apps/api && npm test

# Run E2E tests
npm run test:e2e

# Run specific test file
cd apps/api && npm test -- rls-isolation.e2e-spec.ts

# Run tests with coverage
cd apps/api && npm run test:cov
```

## Docker Operations
```bash
# Start all infrastructure
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs

# Reset all data (destructive)
npm run docker:reset

# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

## Individual Service Commands

### API Service
```bash
cd apps/api

# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Database operations
npm run typeorm:run       # Run migrations
npm run typeorm:generate  # Generate migration
npm run seed             # Seed database

# Testing
npm test                 # Unit tests
npm run test:e2e        # E2E tests
npm run test:cov        # With coverage
```

### Worker Service
```bash
cd apps/worker

# Development
npm run start:dev

# Production
npm run build
npm run start

# Testing
npm test
```

### Packages
```bash
# Build shared packages
cd packages/integrations && npm run build
cd packages/shared && npm run build

# Test integrations
cd packages/integrations && npm test
```

## Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hunters_run
REDIS_URL=redis://localhost:6379

# Firebase Auth (Required)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# AWS S3 (Required for files)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=hunters-run-files

# SendGrid (Required for emails)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx

# Telnyx (Required for SMS)
TELNYX_API_KEY=KEY01xxxxxxxxxxxxxxxxxx

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Optional
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3001
```

### Development vs Production Settings
```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
# Uses local Docker for Postgres/Redis

# Production
NODE_ENV=production
LOG_LEVEL=info
# Use managed services (RDS, ElastiCache, etc.)
DATABASE_URL=postgresql://user:pass@prod-db:5432/hunters_run
REDIS_URL=redis://prod-redis:6379
```

## API Testing

### Health Checks
```bash
# Basic health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/health/ready

# Metrics (Prometheus format)
curl http://localhost:3000/metrics
```

### Authentication Testing
```bash
# Test Firebase auth (requires valid token)
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     -H "x-org-id: 11111111-1111-1111-1111-111111111111" \
     http://localhost:3000/legal/templates
```

### RLS Testing
```bash
# Test data isolation between orgs
# Org A
curl -H "Authorization: Bearer TOKEN" \
     -H "x-org-id: 11111111-1111-1111-1111-111111111111" \
     http://localhost:3000/legal/templates

# Org B (should return different data)
curl -H "Authorization: Bearer TOKEN" \
     -H "x-org-id: 22222222-2222-2222-2222-222222222222" \
     http://localhost:3000/legal/templates
```

## Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Check if Postgres is running
docker ps | grep postgres

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Reset database if corrupted
npm run docker:reset
```

**Migration Issues:**
```bash
# Check migration status
cd apps/api && npm run typeorm -- migration:show

# Revert last migration
cd apps/api && npm run typeorm -- migration:revert

# Manual migration repair
psql $DATABASE_URL -c "DELETE FROM migrations WHERE name = 'problematic_migration'"
```

**RLS Context Issues:**
```bash
# Test RLS manually
psql $DATABASE_URL
SET app.current_org = '11111111-1111-1111-1111-111111111111';
SELECT * FROM hr.properties;
```

**Queue Processing Issues:**
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Monitor queue status
redis-cli -u $REDIS_URL
KEYS bull:notifications:*
LLEN bull:notifications:waiting
```

**File Upload Issues:**
```bash
# Test S3 connectivity
aws s3 ls s3://$AWS_S3_BUCKET --region $AWS_REGION

# Test signed URL generation
curl -X POST http://localhost:3000/files/signed-url?filename=test.jpg&contentType=image/jpeg \
     -H "Authorization: Bearer TOKEN" \
     -H "x-org-id: ORG_ID"
```

### Logs and Debugging
```bash
# View API logs
docker logs hunters-run-api -f

# View worker logs
docker logs hunters-run-worker -f

# View database logs
docker logs hunters-run-db -f

# View Redis logs
docker logs hunters-run-redis -f

# Enable debug logging
export LOG_LEVEL=debug
npm run dev
```

### Performance Monitoring
```bash
# Monitor database connections
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity"

# Monitor Redis memory usage
redis-cli -u $REDIS_URL info memory

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health

# Monitor queue processing
redis-cli -u $REDIS_URL monitor
```

## Production Deployment

### Docker Production Build
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Health check production
curl https://api.yourdomain.com/health
```

### Database Migrations in Production
```bash
# Backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Run migrations
npm run db:migrate

# Verify migration
curl https://api.yourdomain.com/health/ready
```

### Monitoring Setup
```bash
# Set up log aggregation
docker logs hunters-run-api 2>&1 | your-log-service

# Set up metrics collection
curl https://api.yourdomain.com/metrics | prometheus

# Set up alerts
# Configure alerts for:
# - Health check failures
# - Database connection issues
# - Queue processing delays
# - High error rates
```

This completes the comprehensive monorepo setup with all required components:

✅ **Monorepo Structure** - Workspaces, Turbo pipeline, shared packages
✅ **Docker Infrastructure** - Postgres with PostGIS, Redis, healthchecks
✅ **TypeORM Migrations** - Base schema + legal notices patch
✅ **Comprehensive APIs** - Legal, Files, Notifications, Payments
✅ **Security** - Firebase Auth, RLS isolation, request context
✅ **Observability** - Pino logging, health checks, metrics
✅ **Background Processing** - BullMQ workers for notifications/payments
✅ **Complete Test Suite** - RLS isolation, legal transitions, S3, Stripe webhooks
✅ **Production Ready** - Docker builds, environment configs, deployment guides