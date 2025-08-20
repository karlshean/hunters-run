# File/Folder Tree
hunters-run-platform/
├── package.json                 # Root workspace config
├── turbo.json                   # Build pipeline
├── tsconfig.json               # Base TypeScript config
├── .eslintrc.js                # ESLint config
├── .prettierrc                 # Prettier config
├── docker-compose.yml          # Infrastructure
├── .env.example                # Environment template
├── apps/
│   ├── api/                    # NestJS API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/
│   │   │   │   ├── guards/firebase-auth.guard.ts
│   │   │   │   └── strategies/firebase.strategy.ts
│   │   │   ├── common/
│   │   │   │   ├── interceptors/request-context.interceptor.ts
│   │   │   │   ├── filters/global-exception.filter.ts
│   │   │   │   └── decorators/current-org.decorator.ts
│   │   │   ├── database/
│   │   │   │   ├── database.module.ts
│   │   │   │   ├── migrations/
│   │   │   │   │   ├── 1704000000000-InitialSchema.ts
│   │   │   │   │   └── 1704000001000-LegalNoticesPatdh.ts
│   │   │   │   ├── seeds/
│   │   │   │   │   └── seed.ts
│   │   │   │   └── entities/
│   │   │   │       ├── organization.entity.ts
│   │   │   │       ├── property.entity.ts
│   │   │   │       ├── unit.entity.ts
│   │   │   │       ├── tenant.entity.ts
│   │   │   │       ├── legal-template.entity.ts
│   │   │   │       ├── legal-notice.entity.ts
│   │   │   │       └── service-attempt.entity.ts
│   │   │   ├── legal/
│   │   │   │   ├── legal.module.ts
│   │   │   │   ├── templates/
│   │   │   │   │   ├── templates.controller.ts
│   │   │   │   │   ├── templates.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── notices/
│   │   │   │   │   ├── notices.controller.ts
│   │   │   │   │   ├── notices.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   └── service-attempts/
│   │   │   │       ├── service-attempts.controller.ts
│   │   │   │       ├── service-attempts.service.ts
│   │   │   │       └── dto/
│   │   │   ├── files/
│   │   │   │   ├── files.module.ts
│   │   │   │   ├── files.controller.ts
│   │   │   │   └── files.service.ts
│   │   │   ├── notifications/
│   │   │   │   ├── notifications.module.ts
│   │   │   │   ├── notifications.controller.ts
│   │   │   │   └── notifications.service.ts
│   │   │   ├── payments/
│   │   │   │   ├── payments.module.ts
│   │   │   │   ├── payments.controller.ts
│   │   │   │   └── payments.service.ts
│   │   │   └── health/
│   │   │       ├── health.controller.ts
│   │   │       └── metrics.controller.ts
│   │   └── test/
│   │       ├── rls-isolation.e2e-spec.ts
│   │       ├── legal-transitions.e2e-spec.ts
│   │       ├── s3-signed-urls.spec.ts
│   │       └── stripe-webhook.spec.ts
│   └── worker/                 # BullMQ Worker
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── src/
│           ├── main.ts
│           ├── worker.module.ts
│           └── processors/
│               ├── notification.processor.ts
│               └── payment.processor.ts
├── packages/
│   ├── integrations/           # Already provided
│   │   └── ...
│   └── shared/                 # Shared types/utils
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── types/
│           │   ├── legal.types.ts
│           │   └── common.types.ts
│           └── utils/
│               └── validation.ts
└── infra/
    └── init.sql                # Database initialization

# ROOT FILES

## package.json
{
  "name": "hunters-run-platform",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "test:e2e": "cd apps/api && npm run test:e2e",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,js,json,md}\"",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "docker:reset": "docker-compose down -v && docker-compose up -d",
    "db:migrate": "cd apps/api && npm run typeorm:run",
    "db:seed": "cd apps/api && npm run seed",
    "setup": "npm install && npm run docker:up && sleep 15 && npm run db:migrate && npm run db:seed"
  },
  "devDependencies": {
    "turbo": "^1.11.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "prettier": "^3.1.0",
    "eslint": "^8.56.0"
  }
}

## turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "format": {}
  }
}

## tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "declaration": true,
    "removeComments": true
  },
  "exclude": ["node_modules", "dist"]
}

## .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    '@typescript-eslint/recommended',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};

## .prettierrc
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "printWidth": 80,
  "tabWidth": 2
}

## .env.example
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hunters_run
REDIS_URL=redis://localhost:6379

# Firebase Auth
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=hunters-run-files

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx

# Telnyx
TELNYX_API_KEY=KEY01xxxxxxxxxxxxxxxxxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# App Config
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

## docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.3
    container_name: hunters-run-db
    environment:
      POSTGRES_DB: hunters_run
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d hunters_run"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    container_name: hunters-run-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: hunters-run-api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/hunters_run
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api/src:/app/src
      - /app/node_modules
    command: npm run start:dev

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    container_name: hunters-run-worker
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/hunters_run
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/worker/src:/app/src
      - /app/node_modules

volumes:
  postgres_data:
  redis_data: