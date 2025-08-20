# Developer Onboarding Guide

Welcome to **Hunters Run** - a complete property management system with maintenance tracking, payments, and audit trails. This guide will get you from zero to running the full demo in under 10 minutes.

## 📋 Prerequisites

Before you begin, ensure you have:
- **Node.js 20+** ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** ([Download](https://git-scm.com/))
- **VS Code** or your preferred editor
- 4GB free RAM for Docker containers

## 🚀 Quick Start (5 minutes)

### Step 1: Clone the Repository
```bash
# Clone the repository
git clone https://github.com/your-org/hunters-run.git
cd hunters-run

# Or if you have access via SSH
git clone git@github.com:your-org/hunters-run.git
cd hunters-run
```

### Step 2: Install Dependencies
```bash
# Install all workspace dependencies
npm install

# This installs packages for:
# - Root workspace
# - apps/hr-api (NestJS backend)
# - apps/hr-web (React frontend)
# - packages/* (shared libraries)
```

### Step 3: Environment Setup
```bash
# Copy the example environment file
cp .env.example .env

# No changes needed for local development!
# Default values work out of the box
```

### Step 4: Start Everything
```bash
# One command to rule them all! 🎉
npm run dev:all

# This will:
# ✅ Start Docker containers (PostgreSQL + Redis)
# ✅ Run database migrations
# ✅ Seed demo data
# ✅ Start API server on http://localhost:3000
# ✅ Start Web UI on http://localhost:3004
```

Wait about 30 seconds for everything to initialize, then you're ready!

## ✅ Verify Your Setup

### Run CEO Validation
The CEO validation script ensures your environment is correctly configured:

```bash
npm run ceo:validate:sh

# Expected output:
# 🔍 Testing health endpoints...
# [OK]  /api/health => 200
# [OK]  /api/ready => 200
# 🔍 Testing lookups with seeded data...
# [OK]  Lookups units: found seeded unit
# [OK]  Lookups tenants: found seeded tenant
# [OK]  Lookups technicians: found seeded technician
# ✅ CEO validation passed!
```

If you see any errors, check the [Troubleshooting](#troubleshooting) section.

## 🎭 Running the Demo

### Option 1: Full Stack Demo (Recommended)

1. **Open the Tenant Portal**
   ```
   http://localhost:3004/tenant
   ```
   - Upload a photo (any image file)
   - Enter issue title: "Bathroom sink leaking"
   - Submit the work order
   - Note the Ticket ID (e.g., WO-2025-0001)

2. **Switch to Manager Dashboard**
   ```
   http://localhost:3004/manager
   ```
   - See your submitted work order
   - Assign to a technician
   - Change status to "In Progress"
   - Mark as "Completed"
   - Click "Audit Verify" to see the cryptographic proof

3. **Use Role Switcher**
   - Click the role switcher in the top-right
   - Switch between Tenant/Manager/Tech roles
   - Or use URL parameters: `?as=tenant`, `?as=manager`, `?as=tech`

### Option 2: API-Only Demo

```bash
# Run the automated demo workflow
node scripts/demo-workflow.js

# This will:
# 1. Create a work order as a tenant
# 2. Assign it as a manager
# 3. Complete it as a technician
# 4. Verify the audit trail
```

## 🏗️ Project Structure

```
hunters-run/
├── apps/
│   ├── hr-api/          # NestJS backend API
│   │   ├── src/
│   │   │   ├── modules/  # Business logic modules
│   │   │   ├── common/   # Shared services (RLS, Auth, etc.)
│   │   │   └── main.ts   # Application entry point
│   │   └── test/         # E2E and security tests
│   │
│   └── hr-web/          # React frontend
│       └── src/
│           ├── components/  # Reusable UI components
│           └── App.tsx      # Main application
│
├── packages/
│   ├── db/              # Database migrations & seeds
│   │   ├── migrations/  # Sequential SQL migrations
│   │   └── seeds/       # Demo and test data
│   │
│   └── integrations/    # External service adapters
│
├── scripts/             # Automation & utilities
│   ├── demo-workflow.js # Automated demo runner
│   ├── ceo-validate.sh  # Environment validation
│   └── seed-check.ts    # Database seed verification
│
└── docker-compose.yml   # Local infrastructure
```

## 📊 Understanding the System

### Core Concepts

1. **Multi-Tenant Architecture**
   - Every request requires `x-org-id` header
   - Row-Level Security (RLS) isolates data per organization
   - Demo uses fixed org: `00000000-0000-4000-8000-000000000001`

2. **Work Order Flow**
   ```
   Tenant Creates → Manager Assigns → Tech Completes → Audit Verify
        ↓               ↓                ↓                ↓
    [Photo Upload]  [Status: Assigned] [Status: Done]  [Hash Chain]
   ```

3. **Audit Trail**
   - Every change creates an immutable audit entry
   - Cryptographic hash chain ensures tamper-proof history
   - View at: `/api/audit/entity/work_order/{id}`

### Key Technologies

- **Backend**: NestJS, TypeScript, PostgreSQL, Redis
- **Frontend**: React, TypeScript, Vite
- **Infrastructure**: Docker, Docker Compose
- **Security**: RLS, JWT (optional), Audit Hashing

## 🧪 Running Tests

```bash
# All tests
npm test

# Specific test suites
npm run test:security    # RLS and multi-tenant tests
npm run test:e2e         # End-to-end API tests
npm run test:payments:e2e # Payment flow tests

# Web UI tests
npm run -w apps/hr-web test

# Performance tests
npm run perf:smoke       # Quick performance check
npm run perf:load        # Load testing
```

## 🔧 Common Development Tasks

### Database Operations
```bash
# Run migrations
npm run migrate

# Reset database (destructive!)
npm run migrate:reset

# Re-seed demo data
npm run seed

# Validate seed data
npm run ceo:seed-check
```

### Starting Services Individually
```bash
# Start only Docker containers
docker compose up -d

# Start only API
npm run dev:hr

# Start only Web UI
npm run dev:web

# Start with verbose logging
LOG_LEVEL=debug npm run dev:hr
```

### Building for Production
```bash
# Type checking
npm run typecheck

# Build all packages
npm run build:hr    # API
npm run build:web   # Web UI

# Generate OpenAPI spec
npm run openapi:generate
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# API port 3000 in use
lsof -i :3000  # Find process
kill -9 <PID>  # Kill it

# Web port 3004 in use
lsof -i :3004
kill -9 <PID>
```

### Database Connection Failed
```bash
# Check Docker is running
docker ps

# Restart containers
docker compose down
docker compose up -d

# Check logs
docker logs hunters-run-postgres-1
```

### CEO Validation Fails
```bash
# Ensure database is seeded
npm run seed

# Check API is running
curl http://localhost:3000/api/health

# Verify org header is correct
curl -H "x-org-id: 00000000-0000-4000-8000-000000000001" \
  http://localhost:3000/api/lookups/units
```

### Web UI Can't Connect to API
```bash
# Check CORS settings in main.ts
# Should include: http://localhost:3004

# Restart API after changes
npm run dev:hr
```

## 📚 Additional Resources

- [Demo Walkthrough](./demo-walkthrough.md) - Visual guide with ASCII flows
- [API Documentation](http://localhost:3000/api) - OpenAPI/Swagger docs
- [Architecture Docs](./ARCHITECTURE.md) - System design details
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute

## 💡 Pro Tips

1. **Use the Role Switcher**: Quickly test different user perspectives
2. **Check Audit Trails**: Every action is logged at `/api/audit/verify`
3. **Seed Data IDs**: Fixed IDs make testing predictable
   - Org: `00000000-0000-4000-8000-000000000001`
   - Unit: `00000000-0000-4000-8000-000000000003`
   - Tenant: `00000000-0000-4000-8000-000000000004`
4. **Hot Reload**: Both API and Web UI auto-reload on changes
5. **Database GUI**: Connect pgAdmin to `localhost:5432` with `postgres/postgres`

## 🎯 Next Steps

Now that you're up and running:

1. **Explore the Codebase**
   - Start with `apps/hr-api/src/modules/maintenance/`
   - Review RLS policies in `packages/db/migrations/005_enable_rls.sql`

2. **Make Your First Change**
   - Try adding a field to work orders
   - Update both DTO and database schema
   - Run migrations and test

3. **Run the Full Test Suite**
   ```bash
   npm run test:security
   npm run test:e2e
   npm run ceo:validate:sh
   ```

## 🤝 Getting Help

- **Slack**: #hunters-run-dev
- **Issues**: [GitHub Issues](https://github.com/your-org/hunters-run/issues)
- **Wiki**: [Internal Wiki](https://wiki.your-org.com/hunters-run)

---

🎉 **Welcome aboard!** You're now ready to build and improve Hunters Run. Happy coding!