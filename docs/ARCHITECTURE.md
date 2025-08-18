# Architecture
- Monorepo with npm workspaces
- Node 20, Postgres 16, Redis 7
- API for Hunters Run
- Postgres RLS via `SET LOCAL app.current_org` (applied in app layer later)
- Audit chain with hash linking
- Vendors: Firebase Auth, SendGrid, S3, Telnyx, Stripe