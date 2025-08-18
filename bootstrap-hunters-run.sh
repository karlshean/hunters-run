#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Hunters Run – Public Monorepo Bootstrap
# - Idempotent (use --force to overwrite)
# - Dry-run supported (--dry-run)
# - Pins Node 20 / Postgres 16
# - Creates npm workspaces monorepo
# - Adds Docker (Postgres+Redis), CI, SQL migrations
# - Scaffolds API with /api/ready + Stripe/Telnyx webhooks (raw body)
# - Adds Firebase guard, RLS context (schema-only here)
# - Adds migration + validation scripts
# ============================================

NODE_VERSION="20.10.0"
POSTGRES_VERSION="16"
REDIS_VERSION="7"
DRY_RUN="false"
FORCE="false"
SKIP_TESTS="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true"; shift;;
    --force) FORCE="true"; shift;;
    --skip-tests) SKIP_TESTS="true"; shift;;
    *) echo "Unknown flag: $1"; exit 1;;
  esac
done

log()  { printf "\033[1;34m[BOOTSTRAP]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ OK ]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[FAIL]\033[0m %s\n" "$*"; }

ensure_dir() {
  local d="$1"
  if [[ "$DRY_RUN" == "true" ]]; then log "mkdir -p $d"; return; fi
  mkdir -p "$d"
}

write_file() {
  local path="$1"
  local content="$2"
  if [[ -f "$path" && "$FORCE" != "true" ]]; then
    warn "Exists, skip (use --force to overwrite): $path"
    return
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    log "create/update $path"
    return
  fi
  ensure_dir "$(dirname "$path")"
  printf "%s" "$content" > "$path"
  ok "wrote $path"
}

append_file() {
  local path="$1"
  local content="$2"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "append $path"
    return
  fi
  ensure_dir "$(dirname "$path")"
  printf "%s" "$content" >> "$path"
  ok "appended $path"
}

run_cmd() {
  local cmd="$*"
  if [[ "$DRY_RUN" == "true" ]]; then log "(dry-run) $cmd"; return; fi
  log "$cmd"
  eval "$cmd"
}

# Guard: if existing project without --force, stop
if [[ -f "package.json" && "$FORCE" != "true" ]]; then
  warn "package.json already exists here. Re-run with --force to overwrite."
  exit 1
fi

# Root files
write_file package.json "$(cat <<'JSON'
{
  "name": "hunters-run",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=20.10.0" },
  "scripts": {
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down -v",
    "build": "npm -ws run build --if-present",
    "test": "npm -ws run test --if-present",
    "migrate": "node scripts/migrate.js",
    "dev:hr": "npm -w @apps/hr-api run start:dev"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "eslint": "8.57.0",
    "prettier": "3.2.5"
  },
  "dependencies": {
    "pg": "8.12.0"
  }
}
JSON
)"

write_file tsconfig.base.json "$(cat <<'JSON'
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "lib": ["ES2021"],
    "declaration": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@platform/shared/*": ["packages/shared/src/*"],
      "@platform/auth/*": ["packages/auth/src/*"],
      "@platform/db/*": ["packages/db/src/*"],
      "@hunters-run/integrations/*": ["packages/integrations/src/*"]
    }
  }
}
JSON
)"

write_file .gitignore "$(cat <<'EOF'
node_modules
dist
.env
.env.*
.DS_Store
coverage
.vscode
.idea
pgdata
EOF
)"

write_file .env.example "$(cat <<'ENV'
# Firebase (service account)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/unified

# Vendors
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
TELNYX_API_KEY=
TELNYX_MESSAGING_PROFILE_ID=
TELNYX_FROM_NUMBER=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ENV
)"

write_file README.md "$(cat <<'MD'
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
MD
)"

# Docker Compose
write_file docker-compose.yml "$(cat <<YML
version: "3.9"
services:
  postgres:
    image: postgres:${POSTGRES_VERSION}
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: unified
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL","pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 20
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:${REDIS_VERSION}
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD","redis-cli","ping"]
      interval: 5s
      timeout: 3s
      retries: 20
volumes:
  pgdata:
YML
)"

# CI
ensure_dir .github/workflows
write_file .github/workflows/ci.yml "$(cat <<'YML'
name: CI
on:
  push: { branches: [ main ] }
  pull_request:
jobs:
  build-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: unified
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 3s --health-retries 20
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm -w @hunters-run/integrations run build || true
      - run: npm run migrate
      - run: npm test
YML
)"

# Scripts
ensure_dir scripts
write_file scripts/migrate.js "$(cat <<'JS'
/* Run SQL migrations in order using pg */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const files = [
  'packages/db/sql/base.sql',
  'packages/db/sql/legal_patch.sql',
  'packages/db/sql/payments_extra.sql'
];

(async () => {
  const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
  const client = new Client({ connectionString: url });
  await client.connect();
  for (const f of files) {
    const p = path.resolve(f);
    if (!fs.existsSync(p)) {
      console.log(`[migrate] skip missing ${p}`);
      continue;
    }
    const sql = fs.readFileSync(p, 'utf8');
    console.log(`[migrate] applying ${p}`);
    await client.query(sql);
  }
  console.log('[migrate] verifying key tables/columns');
  const q = `
    select
      to_regclass('hr.notice_templates') as nt,
      to_regclass('hr.legal_notices') as ln,
      to_regclass('hr.service_attempts') as sa,
      to_regclass('hr.events') as ev
  `;
  const r = await client.query(q);
  const row = r.rows[0] || {};
  if (!row.nt || !row.ln || !row.sa || !row.ev) {
    console.error('❌ required hr.* tables missing'); process.exit(1);
  }
  await client.end();
  console.log('[migrate] done');
})().catch(e => { console.error(e); process.exit(1); });
JS
)"

write_file scripts/validate-setup.sh "$(cat <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo "[validate] checking /api/ready"
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/ready || echo "000")
if [[ "$code" != "200" ]]; then
  echo "❌ /api/ready returned $code"
  exit 1
fi
echo "✅ ready OK"
SH
)"

if [[ "$DRY_RUN" != "true" ]]; then chmod +x scripts/validate-setup.sh; fi

# Packages: shared, auth, db, integrations
ensure_dir packages/shared/src
write_file packages/shared/package.json "$(cat <<'JSON'
{
  "name": "@platform/shared",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "dependencies": { "zod": "3.23.8" }
}
JSON
)"
write_file packages/shared/tsconfig.json "$(cat <<'JSON'
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src/**/*"] }
JSON
)"
write_file packages/shared/src/env.ts "$(cat <<'TS'
import { z } from "zod";
export const Env = z.object({
  DATABASE_URL: z.string().url(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  TELNYX_API_KEY: z.string().optional(),
  TELNYX_MESSAGING_PROFILE_ID: z.string().optional(),
  TELNYX_FROM_NUMBER: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
});
export function getEnv() { return Env.parse(process.env); }
TS
)"

ensure_dir packages/auth/src
write_file packages/auth/package.json "$(cat <<'JSON'
{
  "name": "@platform/auth",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "dependencies": { "firebase-admin": "12.3.1", "@nestjs/common": "10.3.0" }
}
JSON
)"
write_file packages/auth/tsconfig.json "$(cat <<'JSON'
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src/**/*"] }
JSON
)"
write_file packages/auth/src/firebase.ts "$(cat <<'TS'
import admin from "firebase-admin";
let app: admin.app.App | null = null;
export function getFirebase() {
  if (app) return app;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  } else {
    app = admin.initializeApp();
  }
  return app;
}
export async function verifyIdToken(idToken: string) {
  const fb = getFirebase();
  return fb.auth().verifyIdToken(idToken);
}
TS
)"
write_file packages/auth/src/guards.ts "$(cat <<'TS'
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyIdToken } from "./firebase";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) throw new UnauthorizedException("Missing bearer token");
    try {
      const token = auth.slice(7);
      const decoded = await verifyIdToken(token);
      req.user = { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
TS
)"

ensure_dir packages/db/src
ensure_dir packages/db/sql
write_file packages/db/package.json "$(cat <<'JSON'
{
  "name": "@platform/db",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "dependencies": { "typeorm": "0.3.20", "pg": "8.12.0" }
}
JSON
)"
write_file packages/db/tsconfig.json "$(cat <<'JSON'
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src/**/*"] }
JSON
)"
write_file packages/db/src/datasource.ts "$(cat <<'TS'
import "reflect-metadata";
import { DataSource } from "typeorm";
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: false,
  entities: [],
  migrations: [],
  synchronize: false,
  logging: ["error","warn"]
});
TS
)"

write_file packages/db/sql/base.sql "$(cat <<'SQL'
-- base.sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create schema if not exists platform;
create schema if not exists hr;

-- audit events
create table if not exists hr.events (
  id bigserial primary key,
  organization_id uuid not null,
  actor_uid text,
  event_type text not null,
  subject_type text,
  subject_id bigint,
  payload jsonb,
  prev_hash bytea,
  current_hash bytea not null,
  created_at timestamptz not null default now()
);

create or replace function hr.event_compute_hash(
  prev bytea,
  org uuid,
  actor text,
  etype text,
  stype text,
  sid bigint,
  p jsonb,
  ts timestamptz
) returns bytea as $$
  select digest(
    coalesce(encode(prev,'hex'),'') || coalesce(org::text,'') ||
    coalesce(actor,'') || coalesce(etype,'') ||
    coalesce(stype,'') || coalesce(sid::text,'') ||
    coalesce(p::text,'') || coalesce(ts::text,''),
    'sha256'
  );
$$ language sql immutable;

create or replace function hr.update_event_hash()
returns trigger as $$
declare ph bytea;
begin
  select current_hash into ph
  from hr.events
  where organization_id = new.organization_id
    and id < new.id
  order by id desc limit 1;

  new.prev_hash := coalesce(ph, E'\\x00');
  new.current_hash := hr.event_compute_hash(new.prev_hash, new.organization_id, new.actor_uid,
                                           new.event_type, new.subject_type, new.subject_id,
                                           new.payload, new.created_at);
  return new;
end
$$ language plpgsql;

drop trigger if exists trg_update_event_hash on hr.events;
create trigger trg_update_event_hash
before insert on hr.events
for each row execute function hr.update_event_hash();
SQL
)"

write_file packages/db/sql/legal_patch.sql "$(cat <<'SQL'
-- legal_patch.sql
-- Core legal tables + RLS
create table if not exists hr.notice_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  name text not null,
  description text,
  body_template text not null,
  created_at timestamptz not null default now()
);

create table if not exists hr.legal_notices (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  tenant_id uuid not null,
  template_id uuid not null references hr.notice_templates(id),
  status text not null default 'draft', -- draft|issued|served|filed|void
  variables jsonb not null default '{}',
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hr.service_attempts (
  id bigserial primary key,
  organization_id uuid not null,
  notice_id uuid not null references hr.legal_notices(id) on delete cascade,
  attempt_time timestamptz not null default now(),
  server_name text,
  method text, -- personal|substitute|posting|mail
  success boolean default false,
  notes text
);

-- Webhooks + disputes + sms status
create table if not exists hr.webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  organization_id uuid null,
  primary key (provider, event_id)
);

create table if not exists hr.payment_disputes (
  stripe_dispute_id text primary key,
  organization_id uuid not null,
  charge_id text,
  reason text,
  amount_cents int,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists hr.sms_messages (
  id bigserial primary key,
  organization_id uuid not null,
  to_number text not null,
  from_number text not null,
  body text,
  provider_id text,
  status text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_legal_notices_tenant on hr.legal_notices(tenant_id, status, created_at);
create index if not exists idx_service_attempts_notice on hr.service_attempts(notice_id, attempt_time);
create index if not exists idx_events_org_time on hr.events(organization_id, created_at);

-- Enable RLS + policies
alter table hr.notice_templates enable row level security;
alter table hr.legal_notices enable row level security;
alter table hr.service_attempts enable row level security;
alter table hr.webhook_events enable row level security;
alter table hr.payment_disputes enable row level security;
alter table hr.sms_messages enable row level security;
alter table hr.events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='notice_templates') then
    create policy p_nt on hr.notice_templates using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='legal_notices') then
    create policy p_ln on hr.legal_notices using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='service_attempts') then
    create policy p_sa on hr.service_attempts using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='webhook_events') then
    create policy p_we on hr.webhook_events using (organization_id is null or organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='payment_disputes') then
    create policy p_pd on hr.payment_disputes using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='sms_messages') then
    create policy p_sms on hr.sms_messages using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='events') then
    create policy p_ev on hr.events using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
end$$;
SQL
)"

write_file packages/db/sql/payments_extra.sql "$(cat <<'SQL'
-- payments_extra.sql
-- Reserved for future migrations
SQL
)"

# Integrations (simplified adapters)
ensure_dir packages/integrations/src
write_file packages/integrations/package.json "$(cat <<'JSON'
{
  "name": "@hunters-run/integrations",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "dependencies": {
    "@sendgrid/mail": "8.1.3",
    "@aws-sdk/client-s3": "3.614.0",
    "@aws-sdk/s3-request-presigner": "3.614.0",
    "stripe": "16.8.0",
    "axios": "1.7.4"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "@types/node": "20.12.12"
  }
}
JSON
)"
write_file packages/integrations/tsconfig.json "$(cat <<'JSON'
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src/**/*"] }
JSON
)"
write_file packages/integrations/src/index.ts "$(cat <<'TS'
export type Health = { ok: boolean; provider: string; detail?: string };
export interface EmailAdapter { send(p: {to:string|string[];from:string;subject?:string;html?:string;text?:string;templateId?:string;templateData?:any;}): Promise<{id:string}>; health(): Promise<Health>; }
export interface FileAdapter { getSignedUploadUrl(p:{key:string;mime:string;expiresSec?:number;metadata?:Record<string,string>}): Promise<{url:string;key:string}>; getSignedDownloadUrl(p:{key:string;expiresSec?:number}): Promise<{url:string}>; health(): Promise<Health>; }
export interface SmsAdapter { send(p:{to:string;body:string}): Promise<{id:string}>; health(): Promise<Health>; }
export interface PaymentsAdapter { createCheckout(p:{successUrl:string;cancelUrl:string;lines:Array<{name:string;amountCents:number;quantity:number}>;}): Promise<{url:string;id:string}>; health(): Promise<Health>; }
TS
)"

# API app
ensure_dir apps/hr-api/src/routes
write_file apps/hr-api/package.json "$(cat <<'JSON'
{
  "name": "@apps/hr-api",
  "version": "0.1.0",
  "scripts": {
    "start": "node dist/main.js",
    "start:dev": "tsc -p tsconfig.json --watch & nodemon --watch dist dist/main.js",
    "build": "tsc -p tsconfig.json",
    "test": "echo "(add tests)" && exit 0"
  },
  "dependencies": {
    "@nestjs/common": "10.3.0",
    "@nestjs/core": "10.3.0",
    "@nestjs/platform-express": "10.3.0",
    "@nestjs/config": "3.2.0",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.1",
    "body-parser": "1.20.2",
    "ioredis": "5.4.1",
    "typeorm": "0.3.20",
    "pg": "8.12.0",
    "@platform/auth": "workspace:*",
    "@platform/db": "workspace:*",
    "@platform/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "nodemon": "3.0.2",
    "@types/node": "20.12.12"
  }
}
JSON
)"
write_file apps/hr-api/tsconfig.json "$(cat <<'JSON'
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src/**/*"] }
JSON
)"
write_file apps/hr-api/src/root.module.ts "$(cat <<'TS'
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./routes/health.controller";
import { WebhooksController } from "./routes/webhooks.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, WebhooksController],
  providers: []
})
export class AppModule {}
TS
)"
write_file apps/hr-api/src/main.ts "$(cat <<'TS'
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./root.module";
import * as bodyParser from "body-parser";
import { AppDataSource } from "@platform/db/src/datasource";
import Redis from "ioredis";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Stripe webhook: raw body
  app.use('/api/payments/webhook', bodyParser.raw({ type: 'application/json' }));
  // JSON for everything else
  app.use(bodyParser.json());

  await AppDataSource.initialize().catch((e)=>{ console.error("DB init error", e); });

  // Attach Redis for readiness checks
  (app as any).locals = { redis: new Redis(process.env.REDIS_URL || "redis://localhost:6379") };

  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
TS
)"
write_file apps/hr-api/src/routes/health.controller.ts "$(cat <<'TS'
import { Controller, Get, Req } from "@nestjs/common";
import { AppDataSource } from "@platform/db/src/datasource";

@Controller()
export class HealthController {
  @Get("api/health")
  health() { return { ok: true, service: "hr-api" }; }

  @Get("api/ready")
  async ready(@Req() req: any) {
    try { await AppDataSource.query("select 1"); } catch { return { ok:false, db:false, redis:false, error:"db_failed" }; }
    try { await req.app.locals.redis.ping(); } catch { return { ok:false, db:true, redis:false, error:"redis_failed" }; }
    return { ok:true, db:true, redis:true };
  }
}
TS
)"
write_file apps/hr-api/src/routes/webhooks.controller.ts "$(cat <<'TS'
import { Controller, Post, Req, Headers } from "@nestjs/common";
import Stripe from "stripe";
import { AppDataSource } from "@platform/db/src/datasource";

@Controller()
export class WebhooksController {
  @Post("api/payments/webhook")
  async stripe(@Req() req: any, @Headers("stripe-signature") sig?: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return { ok: false, error: "no_webhook_secret" };
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" as any });
    let event: Stripe.Event;
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : req.rawBody;
      event = stripe.webhooks.constructEvent(raw, sig!, secret);
    } catch (e:any) {
      return { ok: false, error: "sig_verify_failed" };
    }
    await AppDataSource.query(
      "insert into hr.webhook_events(provider, event_id, payload) values($1,$2,$3) on conflict (provider,event_id) do nothing",
      ['stripe', event.id, event as any]
    );
    if (event.type === "charge.dispute.created") {
      const d: any = event.data.object;
      await AppDataSource.query(
        `insert into hr.payment_disputes(stripe_dispute_id, organization_id, charge_id, reason, amount_cents, status)
         values($1, $2, $3, $4, $5, $6)
         on conflict (stripe_dispute_id) do update set status=excluded.status`,
        [d.id, null, d.charge, d.reason, d.amount, d.status]
      );
    }
    return { ok: true };
  }
}
TS
)"

# Docs
ensure_dir docs/ADR
write_file docs/ARCHITECTURE.md "$(cat <<'MD'
# Architecture
- Monorepo with npm workspaces
- Node 20, Postgres 16, Redis 7
- API for Hunters Run
- Postgres RLS via `SET LOCAL app.current_org` (applied in app layer later)
- Audit chain with hash linking
- Vendors: Firebase Auth, SendGrid, S3, Telnyx, Stripe
MD
)"
write_file docs/BACKLOG.md "$(cat <<'MD'
# Backlog (live)
## Decisions
- [ ] Pick cloud region and S3 bucket
- [ ] Confirm Stripe/Telnyx/SendGrid accounts

## Tasks
- [ ] Fill env values, run end-to-end
- [ ] Add DTO validation and legal routes
- [ ] Add RLS drift snapshot test

## Risks
- RLS misconfig could leak data
- Stripe webhook signature must use raw body
MD
)"
write_file docs/ADR/0001-rls.md "$(cat <<'MD'
# ADR-0001: RLS Strategy
- Single DB, schema-per-product (hr)
- RLS by organization_id, enforced via `SET LOCAL app.current_org`
- Policies defined on hr tables
MD
)"

ok "Bootstrap files created."
if [[ "$DRY_RUN" == "true" ]]; then
  warn "Dry-run mode: no files written. Re-run without --dry-run to generate."
  exit 0
fi

ok "Next steps:"
echo "1) npm ci"
echo "2) npm run docker:up"
echo "3) npm run migrate"
echo "4) npm run dev:hr"
echo "5) ./scripts/validate-setup.sh"
