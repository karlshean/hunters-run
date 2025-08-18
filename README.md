# Hunters Run – Public Monorepo

- Node 20, Postgres 16, Redis 7
- npm workspaces
- Docker Compose for local DBs
- API (apps/hr-api) with /api/ready and webhooks
- SQL migrations (packages/db/sql)

## Quick start
```bash
cp .env.example .env   # fill later
npm ci
npm run docker:up
npm run migrate
npm run dev:hr
curl -i http://localhost:3000/api/ready
```