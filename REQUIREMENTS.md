# Hunters Run – Requirements v1.0 (FROZEN)
Status: **Locked**
Owner: **Karl**
Effective: **Today**

## Platform Baseline
- **Node**: 20.x
- **Postgres**: 16.x
- **Redis**: 7.x
- **Repo**: Monorepo using npm workspaces

## Bootstrap Must‑Haves (Binding)
- Docker services for **Postgres + Redis** with healthchecks.
- SQL migrations: `hr.events` (hash chain), legal tables (`notice_templates`, `legal_notices`, `service_attempts`), webhook tables, **RLS policies**.
- API app with `/api/ready` (checks DB + Redis) and **Stripe raw‑body** webhook route with **idempotent** event storage.
- CI that boots Postgres/Redis, applies migrations, and runs tests.
- **No secrets** in repo. Only `.env.example` is committed.

## Guardrails
- `bootstrap-hunters-run.sh` must match this spec.
- Any change to behavior **must** update this file via PR, include an ADR, and bump version:
  - Additive = v1.MINOR (v1.1, v1.2, …)
  - Breaking = v2.0

## Out of Scope (v1.0)
- Cloud deploy steps (AWS/GCP) – may be added in v1.1+.
- Non‑Stripe payments.
- Multi‑region database topology.
