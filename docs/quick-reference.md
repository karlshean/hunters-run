# Quick Reference Card

## 🚀 Essential Commands

```bash
# Start everything
npm run dev:all

# Validate setup
npm run ceo:validate:sh

# Access points
API:     http://localhost:3000/api
Web:     http://localhost:3004
Tenant:  http://localhost:3004/tenant
Manager: http://localhost:3004/manager
```

## 🔑 Fixed Demo IDs

```
Organization: 00000000-0000-4000-8000-000000000001
Unit:        00000000-0000-4000-8000-000000000003
Tenant:      00000000-0000-4000-8000-000000000004
Technician:  00000000-0000-4000-8000-000000000005
```

## 📝 Common Tasks

| Task | Command |
|------|---------|
| Reset database | `npm run migrate:reset && npm run seed` |
| Run tests | `npm test` |
| Check types | `npm run typecheck` |
| View API logs | `docker logs hunters-run-api-1 -f` |
| DB console | `docker exec -it hunters-run-postgres-1 psql -U postgres -d unified` |

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| Port in use | `lsof -i :3000` then `kill -9 <PID>` |
| DB connection failed | `docker compose down && docker compose up -d` |
| Web can't reach API | Check CORS includes `:3004` in `main.ts` |
| Tests failing | Run `npm run seed` first |

## 📡 API Testing

```bash
# Test with curl
curl -H "x-org-id: 00000000-0000-4000-8000-000000000001" \
  http://localhost:3000/api/lookups/units

# Create work order
curl -X POST http://localhost:3000/api/maintenance/work-orders \
  -H "Content-Type: application/json" \
  -H "x-org-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"title":"Test","unitId":"00000000-0000-4000-8000-000000000003"}'
```

## 🎯 Demo Flow

1. **Tenant** → Submit work order with photo
2. **Manager** → Assign to technician
3. **Tech** → Complete work
4. **Manager** → Verify audit trail

## 🔍 Database Queries

```sql
-- View work orders
SELECT * FROM hr.work_orders;

-- Check audit log
SELECT * FROM hr.events ORDER BY created_at DESC;

-- Verify RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'hr';
```

---
*Keep this handy while developing!*