# Hunters Run – Property Management System

Complete maintenance and payments management with audit trails, RLS security, and Stripe integration.

[![Demo Flow](https://img.shields.io/badge/📺_Demo_Flow-Available-brightgreen?style=for-the-badge)](docs/demo.md)

**Tech Stack:** Node 20, Postgres 16, Redis 7, NestJS, React

## How to Run

### One-Command Setup
```bash
# Install dependencies
npm install

# Start everything (API + Web UI)
npm run dev:all
```

**That's it!** This will:
- Start Docker containers (Postgres + Redis)
- Run database migrations and seed data
- Start API on **http://localhost:3000**
- Start Web UI on **http://localhost:3001**

### Alternative: API Only
```bash
# Just the backend API
npm run dev:stack
```

### Manual Setup (if needed)
```bash
cp .env.example .env
npm install
docker compose up -d
npm run migrate
npm run seed:local
npm run dev:hr  # API only
```

## Access Points

- **API**: http://localhost:3000/api/health
- **API Ready Check**: http://localhost:3000/api/ready (alias: http://localhost:3000/api/health/ready)
- **Web UI**: http://localhost:3001 (minimal health checker)
- **Full Demo**: Use the API endpoints or run scripts

## Testing

```bash
# Quick smoke test (waits for API, tests endpoints)
npm run smoke

# Full test suite
npm run test:hr
npm run test:hr:e2e
npm run test:payments:e2e
```

## Demo Scripts

```bash
# Test maintenance workflow
node scripts/demo-workflow.js

# Test payments flow
bash scripts/demo-payments.sh
```

## Features

- **Work Orders**: Create, assign, track maintenance requests
- **Payments**: Stripe integration with oldest-first allocation
- **Audit Trail**: Cryptographic hash chain for compliance
- **Multi-Tenant**: RLS policies for organization isolation
- **Real-time**: WebSocket updates and status changes

## Database Backup & Restore (Windows/PowerShell)

Prereqs: PostgreSQL client tools on PATH (psql/pg_dump/pg_restore), and DATABASE_URL set.

Set env:
```powershell
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/hunters_run"
```

Create backup:
```bash
npm run db:backup
```

Restore latest backup (safe – refuses if DB not empty):
```bash
npm run db:restore
```

Force restore (destructive):
```bash
npm run db:restore -- -Force
```

Self-check (backup → drop marker → restore → verify):
```bash
npm run db:selfcheck
```

## Port Reference

- **3000**: API backend (all /api/* endpoints)
- **3001**: Web UI (minimal health checker)
- **5432**: PostgreSQL database
- **6379**: Redis cache

Avoid port confusion: the API is always on 3000, web UI is on 3001.