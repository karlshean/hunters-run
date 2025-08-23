# RLS & Org Context

All `hr.*` tables use PostgreSQL Row-Level Security (RLS) scoped to `organization_id`.

The app sets `app.current_organization` at the start of each request (derived from the `x-org-id` header).
Policies use:
```sql
current_setting('app.current_organization', true)::uuid
```
in both USING and WITH CHECK clauses.

## Why:
- Prevent cross-org leaks
- Keep API + direct SQL access consistent and audit-safe
- Make org scoping a default, not a best-effort

## Contributor rule: when adding a new hr.* table, always add:
- `organization_id uuid not null`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- A policy with both USING and WITH CHECK
- Index on `(organization_id, created_at)` if time-series reads are likely