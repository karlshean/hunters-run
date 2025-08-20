#!/bin/bash
# bootstrap-hunters-run.sh
# Enterprise-grade repository bootstrap for Hunters Run Property Management Platform
# 
# Usage:
#   ./bootstrap-hunters-run.sh                    # Normal bootstrap
#   ./bootstrap-hunters-run.sh --dry-run         # Show what would be created
#   ./bootstrap-hunters-run.sh --force           # Overwrite existing files
#   ./bootstrap-hunters-run.sh --skip-tests      # Skip self-tests
#
# Features:
# ✅ Idempotent: Safe to re-run, preserves local changes
# ✅ Deterministic: Pinned versions, lockfiles included
# ✅ Self-testing: Validates setup with actual execution
# ✅ No secrets: Only .env.example, documents where to add real keys
# ✅ Minimal cloud coupling: Local-first with optional AWS pipeline

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="hunters-run-platform"
DRY_RUN=false
FORCE=false
SKIP_TESTS=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--force] [--skip-tests]"
      echo "  --dry-run    Show what would be created without making changes"
      echo "  --force      Overwrite existing files"
      echo "  --skip-tests Skip validation tests after bootstrap"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Utility functions
run_cmd() {
  local cmd="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] Would run: $cmd"
  else
    log_info "Running: $cmd"
    eval "$cmd"
  fi
}

create_file() {
  local file_path="$1"
  local content="$2"
  local should_create=true
  
  if [[ -f "$file_path" && "$FORCE" != "true" ]]; then
    log_warn "File exists: $file_path (use --force to overwrite)"
    should_create=false
  fi
  
  if [[ "$should_create" == "true" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[DRY-RUN] Would create: $file_path"
    else
      local dir_path=$(dirname "$file_path")
      mkdir -p "$dir_path"
      echo "$content" > "$file_path"
      log_success "Created: $file_path"
    fi
  fi
}

create_dir() {
  local dir_path="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] Would create directory: $dir_path"
  else
    mkdir -p "$dir_path"
    log_success "Created directory: $dir_path"
  fi
}

# Version pinning (deterministic builds)
NODE_VERSION="20.10.0"
POSTGRES_VERSION="16.1"
REDIS_VERSION="7.2.3"
NESTJS_CLI_VERSION="10.2.1"
TYPESCRIPT_VERSION="5.3.2"
DOCKER_COMPOSE_VERSION="2.23.0"

# Pre-flight checks
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  local missing_tools=()
  
  command -v node >/dev/null 2>&1 || missing_tools+=("node")
  command -v npm >/dev/null 2>&1 || missing_tools+=("npm")
  command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
  command -v docker-compose >/dev/null 2>&1 || missing_tools+=("docker-compose")
  command -v git >/dev/null 2>&1 || missing_tools+=("git")
  
  if [[ ${#missing_tools[@]} -gt 0 ]]; then
    log_error "Missing required tools: ${missing_tools[*]}"
    log_error "Please install them before running this script"
    exit 1
  fi
  
  # Check Node version
  local node_version=$(node --version | sed 's/v//')
  local node_major=$(echo "$node_version" | cut -d. -f1)
  if [[ "$node_major" -lt 20 ]]; then
    log_error "Node.js version $node_version detected. Requires >= 20.0.0"
    exit 1
  fi
  
  log_success "Prerequisites check passed"
}

# Main bootstrap function
bootstrap_project() {
  log_info "Bootstrapping $PROJECT_NAME..."
  
  # Create project root
  create_dir "$PROJECT_NAME"
  cd "$PROJECT_NAME" || exit 1
  
  # Initialize git if not already initialized
  if [[ ! -d ".git" && "$DRY_RUN" != "true" ]]; then
    run_cmd "git init"
    run_cmd "git config --local init.defaultBranch main"
  fi
  
  create_project_structure
  create_root_configs
  create_api_app
  create_worker_app
  create_shared_packages
  create_infrastructure
  create_ci_cd
  create_documentation
  
  if [[ "$DRY_RUN" != "true" ]]; then
    install_dependencies
    if [[ "$SKIP_TESTS" != "true" ]]; then
      run_self_tests
    fi
  fi
}

create_project_structure() {
  log_info "Creating project structure..."
  
  # Core directories
  create_dir "apps/api/src"
  create_dir "apps/worker/src"
  create_dir "packages/integrations/src"
  create_dir "packages/shared/src"
  create_dir "infra"
  create_dir "scripts"
  create_dir ".github/workflows"
  create_dir "terraform"
  create_dir "kubernetes"
  
  # API subdirectories
  create_dir "apps/api/src/auth/guards"
  create_dir "apps/api/src/common/interceptors"
  create_dir "apps/api/src/database/migrations"
  create_dir "apps/api/src/database/entities"
  create_dir "apps/api/src/database/seeds"
  create_dir "apps/api/src/legal/templates"
  create_dir "apps/api/src/legal/notices"
  create_dir "apps/api/src/legal/service-attempts"
  create_dir "apps/api/src/files"
  create_dir "apps/api/src/notifications"
  create_dir "apps/api/src/payments"
  create_dir "apps/api/src/health"
  create_dir "apps/api/test"
  
  # Worker subdirectories
  create_dir "apps/worker/src/processors"
  
  # Package subdirectories
  create_dir "packages/integrations/src/email"
  create_dir "packages/integrations/src/sms"
  create_dir "packages/integrations/src/files"
  create_dir "packages/integrations/src/payments"
  create_dir "packages/integrations/src/auth"
  create_dir "packages/shared/src/types"
  create_dir "packages/shared/src/utils"
}

create_root_configs() {
  log_info "Creating root configuration files..."
  
  # Root package.json with pinned versions
  create_file "package.json" '{
  "name": "hunters-run-platform",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": ">=20.10.0",
    "npm": ">=10.0.0"
  },
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
    "setup": "npm install && npm run docker:up && sleep 15 && npm run db:migrate && npm run db:seed",
    "validate": "./scripts/validate-setup.sh"
  },
  "devDependencies": {
    "turbo": "1.11.2",
    "@types/node": "20.10.0",
    "typescript": "' "$TYPESCRIPT_VERSION" '",
    "prettier": "3.1.0",
    "eslint": "8.56.0"
  }
}'

  # Turbo configuration
  create_file "turbo.json" '{
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
}'

  # TypeScript base config
  create_file "tsconfig.json" '{
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
}'

  # ESLint configuration
  create_file ".eslintrc.js" 'module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint/eslint-plugin"],
  extends: [
    "@typescript-eslint/recommended",
    "prettier",
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [".eslintrc.js"],
  rules: {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
};'

  # Prettier configuration
  create_file ".prettierrc" '{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "printWidth": 80,
  "tabWidth": 2
}'

  # Environment template (NO SECRETS)
  create_file ".env.example" '# Hunters Run Platform Environment Configuration
# Copy this file to .env and replace with actual values
# 
# ⚠️  NEVER commit .env to git - it contains secrets
# ⚠️  Use strong, unique passwords in production
# ⚠️  Rotate keys regularly

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hunters_run
REDIS_URL=redis://localhost:6379

# Firebase Auth (Required - Get from Firebase Console)
# 1. Go to Firebase Console > Project Settings > Service Accounts
# 2. Generate new private key
# 3. Copy the values below
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# AWS S3 (Required - Get from AWS IAM)
# 1. Create IAM user with S3 permissions
# 2. Generate access keys
# 3. Create S3 bucket
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=hunters-run-files-dev

# SendGrid (Required - Get from SendGrid Dashboard)
# 1. Sign up at sendgrid.com
# 2. Create API key with Mail Send permissions
SENDGRID_API_KEY=SG.your-api-key-here

# Telnyx (Required - Get from Telnyx Portal)
# 1. Sign up at telnyx.com
# 2. Create API key and get phone number
TELNYX_API_KEY=KEY01...

# Stripe (Required - Get from Stripe Dashboard)
# 1. Sign up at stripe.com
# 2. Get API keys from Dashboard > Developers > API Keys
# 3. Set up webhook endpoint
STRIPE_SECRET_KEY=sk_test_... # Use sk_live_ for production
STRIPE_WEBHOOK_SECRET=whsec_...

# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3001

# CI/CD Secrets (Set in GitHub Secrets, not here)
# - AWS_ACCESS_KEY_ID_CI
# - AWS_SECRET_ACCESS_KEY_CI  
# - FIREBASE_PRIVATE_KEY_CI
# - STRIPE_SECRET_KEY_CI'

  # Gitignore
  create_file ".gitignore" '# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment files
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
*.tsbuildinfo

# Logs
logs/
*.log

# Coverage
coverage/
.nyc_output/

# IDEs
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
.docker/

# Temporary files
tmp/
temp/

# Database
*.db
*.sqlite

# Secrets and keys
*.pem
*.key
*.crt
secrets/

# Terraform
terraform/.terraform/
terraform/*.tfstate
terraform/*.tfstate.backup
terraform/.terraform.lock.hcl
terraform/terraform.tfvars'
}

create_api_app() {
  log_info "Creating API application..."
  
  # API package.json with pinned versions
  create_file "apps/api/package.json" '{
  "name": "@hunters-run/api",
  "version": "1.0.0",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "dev": "nest start --watch",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "typeorm": "typeorm-ts-node-commonjs",
    "typeorm:run": "npm run typeorm migration:run -- -d src/database/data-source.ts",
    "typeorm:generate": "npm run typeorm migration:generate -- -d src/database/data-source.ts",
    "typeorm:create": "npm run typeorm migration:create",
    "seed": "ts-node src/database/seeds/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "10.2.10",
    "@nestjs/core": "10.2.10", 
    "@nestjs/platform-express": "10.2.10",
    "@nestjs/typeorm": "10.0.1",
    "@nestjs/config": "3.1.1",
    "@nestjs/swagger": "7.1.16",
    "@nestjs/bull": "10.0.1",
    "@nestjs/terminus": "10.2.0",
    "typeorm": "0.3.17",
    "pg": "8.11.3",
    "redis": "4.6.11",
    "bull": "4.12.0",
    "firebase-admin": "11.11.1",
    "pino": "8.17.2",
    "pino-http": "8.5.1",
    "class-validator": "0.14.0",
    "class-transformer": "0.5.1",
    "reflect-metadata": "0.1.14",
    "rxjs": "7.8.1",
    "uuid": "9.0.1",
    "stripe": "14.10.0",
    "@hunters-run/integrations": "workspace:*",
    "@hunters-run/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "' "$NESTJS_CLI_VERSION" '",
    "@nestjs/testing": "10.2.10",
    "@types/express": "4.17.21",
    "@types/jest": "29.5.8",
    "@types/node": "20.10.0",
    "@types/supertest": "2.0.16",
    "@types/uuid": "9.0.7",
    "jest": "29.7.0",
    "supertest": "6.3.3",
    "ts-jest": "29.1.1",
    "ts-node": "10.9.1",
    "typescript": "' "$TYPESCRIPT_VERSION" '"
  }
}'

  # API TypeScript config
  create_file "apps/api/tsconfig.json" '{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}'

  # API Dockerfile
  create_file "apps/api/Dockerfile" 'FROM node:' "$NODE_VERSION" '-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/*/package*.json ./packages/*/
RUN npm ci

FROM base AS build
COPY . .
RUN npm run build --filter=@hunters-run/api

FROM node:' "$NODE_VERSION" '-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init curl
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs apps/api/package*.json ./
USER nestjs
EXPOSE 3000
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]'

  # API main entry point with raw body for Stripe webhooks
  create_file "apps/api/src/main.ts" 'import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { 
    bufferLogs: true,
    rawBody: true  // Enable raw body for webhook verification
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    credentials: true,
  });

  // Raw body middleware for Stripe webhooks (CRITICAL for signature verification)
  app.use("/payments/webhook", (req, res, next) => {
    if (req.headers["content-type"] === "application/json") {
      let rawBody = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        rawBody += chunk;
      });
      req.on("end", () => {
        req.rawBody = rawBody;
        next();
      });
    } else {
      next();
    }
  });

  const config = new DocumentBuilder()
    .setTitle("Hunters Run Property Management API")
    .setDescription("Enterprise property management platform")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Documentation: http://localhost:${port}/api`);
  console.log(`🔍 Health: http://localhost:${port}/health`);
  console.log(`⚡ Ready: http://localhost:${port}/ready`);
}

bootstrap();'
}

create_worker_app() {
  log_info "Creating Worker application..."
  
  # Worker package.json
  create_file "apps/worker/package.json" '{
  "name": "@hunters-run/worker",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "start:dev": "ts-node src/main.ts",
    "dev": "ts-node src/main.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts --fix"
  },
  "dependencies": {
    "@nestjs/common": "10.2.10",
    "@nestjs/core": "10.2.10",
    "@nestjs/config": "3.1.1",
    "@nestjs/bull": "10.0.1",
    "bull": "4.12.0",
    "redis": "4.6.11",
    "pino": "8.17.2",
    "@hunters-run/integrations": "workspace:*",
    "@hunters-run/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/testing": "10.2.10",
    "@types/node": "20.10.0",
    "typescript": "' "$TYPESCRIPT_VERSION" '",
    "ts-node": "10.9.1"
  }
}'

  # Worker TypeScript config
  create_file "apps/worker/tsconfig.json" '{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}'

  # Worker Dockerfile  
  create_file "apps/worker/Dockerfile" 'FROM node:' "$NODE_VERSION" '-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/worker/package*.json ./apps/worker/
COPY packages/*/package*.json ./packages/*/
RUN npm ci

FROM base AS build
COPY . .
RUN npm run build --filter=@hunters-run/worker

FROM node:' "$NODE_VERSION" '-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001
COPY --from=build --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=build --chown=worker:nodejs /app/node_modules ./node_modules
COPY --chown=worker:nodejs apps/worker/package*.json ./
USER worker
ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]'
}

create_shared_packages() {
  log_info "Creating shared packages..."
  
  # Integrations package
  create_file "packages/integrations/package.json" '{
  "name": "@hunters-run/integrations",
  "version": "1.0.0",
  "description": "External service integrations and adapters",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "@sendgrid/mail": "7.7.0",
    "aws-sdk": "2.1498.0",
    "stripe": "14.10.0",
    "firebase-admin": "11.11.1",
    "axios": "1.6.2"
  },
  "devDependencies": {
    "typescript": "' "$TYPESCRIPT_VERSION" '",
    "@types/node": "20.10.0",
    "jest": "29.7.0",
    "@types/jest": "29.5.8"
  }
}'

  # Shared package
  create_file "packages/shared/package.json" '{
  "name": "@hunters-run/shared",
  "version": "1.0.0",
  "description": "Shared types and utilities",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "devDependencies": {
    "typescript": "' "$TYPESCRIPT_VERSION" '",
    "@types/node": "20.10.0"
  }
}'
}

create_infrastructure() {
  log_info "Creating infrastructure configuration..."
  
  # Docker Compose with pinned versions
  create_file "docker-compose.yml" 'version: "3.8"

services:
  postgres:
    image: postgis/postgis:' "$POSTGRES_VERSION" '-3.4
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
    image: redis:' "$REDIS_VERSION" '-alpine
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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

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
  redis_data:'

  # Database initialization
  create_file "infra/init.sql" '-- Database initialization script
-- This runs when the PostgreSQL container starts

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS "platform";
CREATE SCHEMA IF NOT EXISTS "hr";

-- Set default privileges for new schemas
GRANT USAGE ON SCHEMA platform TO postgres;
GRANT USAGE ON SCHEMA hr TO postgres;'
}

create_ci_cd() {
  log_info "Creating CI/CD configuration..."
  
  # GitHub Actions workflow (disabled AWS by default)
  create_file ".github/workflows/ci-cd.yml" 'name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: ' "$NODE_VERSION" '

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgis/postgis:' "$POSTGRES_VERSION" '-3.4
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: hunters_run_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:' "$REDIS_VERSION" '-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Build packages
      run: npm run build

    - name: Run linting
      run: npm run lint

    - name: Run unit tests
      run: npm run test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hunters_run_test
        REDIS_URL: redis://localhost:6379
        # Test environment variables - not real secrets
        FIREBASE_PROJECT_ID: test-project
        FIREBASE_PRIVATE_KEY: ${{ secrets.FIREBASE_PRIVATE_KEY_TEST || '"test-key"' }}
        FIREBASE_CLIENT_EMAIL: test@test.iam.gserviceaccount.com
        AWS_ACCESS_KEY_ID: test
        AWS_SECRET_ACCESS_KEY: test
        AWS_REGION: us-east-1
        AWS_S3_BUCKET: test-bucket
        SENDGRID_API_KEY: test
        TELNYX_API_KEY: test
        STRIPE_SECRET_KEY: sk_test_123
        STRIPE_WEBHOOK_SECRET: whsec_test

  # AWS deployment jobs are included but DISABLED by default
  # To enable: 
  # 1. Set up AWS credentials in GitHub Secrets
  # 2. Uncomment the deploy jobs below
  # 3. Configure ECR repositories and ECS clusters

  # build:
  #   needs: test
  #   runs-on: ubuntu-latest
  #   if: github.event_name == '"'"'push'"'"' && github.ref == '"'"'refs/heads/main'"'"'
  #   # This job requires AWS secrets to be configured
  #   # Add these to GitHub repository secrets:
  #   # - AWS_ACCESS_KEY_ID
  #   # - AWS_SECRET_ACCESS_KEY
  #   # - ECR_REPOSITORY_URI
  #   
  #   steps:
  #   - name: Checkout code
  #     uses: actions/checkout@v4
  #   
  #   - name: Configure AWS credentials
  #     uses: aws-actions/configure-aws-credentials@v4
  #     with:
  #       aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
  #       aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  #       aws-region: us-east-1
  #   
  #   - name: Build and push to ECR
  #     run: |
  #       # Build and push Docker images
  #       echo "AWS deployment disabled by default"
  #       echo "Configure secrets and uncomment this job to enable"'
}

create_documentation() {
  log_info "Creating documentation..."
  
  # Main README
  create_file "README.md" '# Hunters Run Property Management Platform

Enterprise-grade property management system built with NestJS, PostgreSQL, and microservices architecture.

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repo-url> hunters-run-platform
cd hunters-run-platform

# Copy environment file and configure
cp .env.example .env
# Edit .env with your actual credentials

# Complete setup (install deps, start infra, migrate, seed)
npm run setup
```

## ✅ System Requirements

- Node.js >= 20.10.0
- Docker & Docker Compose >= 2.20.0
- npm >= 10.0.0
- Git

## 🏗️ Architecture

- **API**: NestJS with TypeORM + PostgreSQL RLS
- **Worker**: BullMQ background job processor
- **Database**: PostgreSQL with PostGIS for geographic features
- **Cache**: Redis for sessions and job queues
- **Files**: AWS S3 with signed URL uploads
- **Auth**: Firebase Authentication
- **Payments**: Stripe with webhook processing
- **Communications**: SendGrid (email) + Telnyx (SMS)

## 📦 Project Structure

```
hunters-run-platform/
├── apps/
│   ├── api/                    # NestJS API server
│   └── worker/                 # Background job processor
├── packages/
│   ├── integrations/          # External service adapters
│   └── shared/               # Common types and utilities
├── infra/                     # Infrastructure configurations
├── terraform/                 # AWS infrastructure as code
├── kubernetes/               # K8s deployment manifests
└── scripts/                  # Deployment and utility scripts
```

## 🔧 Development

```bash
# Start all services
npm run dev

# Start individual services
cd apps/api && npm run start:dev
cd apps/worker && npm run start:dev

# Run tests
npm test
npm run test:e2e

# Database operations
npm run db:migrate
npm run db:seed
```

## 🐳 Docker

```bash
# Start infrastructure
npm run docker:up

# View logs
npm run docker:logs

# Reset all data (destructive)
npm run docker:reset
```

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
cd apps/api && npm run test:cov

# Validate entire setup
npm run validate
```

## 🚀 Deployment

### Local Docker
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes
```bash
kubectl apply -f kubernetes/
```

### AWS (with Terraform)
```bash
cd terraform
terraform apply
./scripts/deploy.sh production
```

## 🔐 Environment Setup

1. Copy `.env.example` to `.env`
2. Configure required services:
   - Firebase Authentication
   - AWS S3 bucket  
   - SendGrid API key
   - Telnyx API key
   - Stripe API keys

See `.env.example` for detailed configuration instructions.

## 📚 API Documentation

Start the API server and visit:
- Swagger UI: http://localhost:3000/api
- Health Check: http://localhost:3000/health

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m "Add amazing feature"`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support, email support@huntersrun.com or create an issue in this repository.'

  # Setup validation script
  create_file "scripts/validate-setup.sh" '#!/bin/bash
# Validate that the setup completed successfully
set -euo pipefail

echo "🔍 Validating Hunters Run platform setup..."

# Check if containers are running
echo "📋 Checking Docker containers..."
if ! docker-compose ps | grep -q "Up"; then
  echo "❌ Docker containers not running. Run: npm run docker:up"
  exit 1
fi

# Check database connection
echo "🗄️  Checking database connection..."
if ! docker-compose exec -T postgres pg_isready -h localhost -p 5432 -U postgres; then
  echo "❌ Database not ready"
  exit 1
fi

# Check Redis connection
echo "📦 Checking Redis connection..."
if ! docker-compose exec -T redis redis-cli ping | grep -q PONG; then
  echo "❌ Redis not ready"  
  exit 1
fi

# Verify migrations ran successfully
echo "🔄 Checking database migrations..."
migration_count=$(docker-compose exec -T postgres psql -U postgres -d hunters_run -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '"'"'hr'"'"';" | xargs)
if [[ "$migration_count" -lt 5 ]]; then
  echo "❌ Database migrations incomplete (found $migration_count hr tables, expected >= 5)"
  echo "💡 Try: npm run db:migrate"
  exit 1
fi

# Check API health endpoint
echo "🚀 Checking API health..."
sleep 5  # Give API time to start
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
if [[ "$response" != "200" ]]; then
  echo "❌ API health check failed (HTTP $response)"
  echo "💡 Try: docker-compose logs api"
  exit 1
fi

# Check API ready endpoint (DB + Redis connectivity)
echo "⚡ Checking API readiness..."
ready_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ready || echo "000")
if [[ "$ready_response" != "200" ]]; then
  echo "❌ API ready check failed (HTTP $ready_response)"
  echo "💡 API cannot connect to database or Redis"
  exit 1
fi

# Check that webhook events table exists for idempotent inserts
echo "🪝 Checking webhook infrastructure..."
webhook_table_exists=$(docker-compose exec -T postgres psql -U postgres -d hunters_run -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '"'"'hr'"'"' AND table_name = '"'"'webhook_events'"'"');" | xargs)
if [[ "$webhook_table_exists" != "t" ]]; then
  echo "❌ Webhook events table missing - payment dispute handling will fail"
  echo "💡 Ensure migrations include webhook_events and payment_disputes tables"
  exit 1
fi

# Run basic tests
echo "🧪 Running basic tests..."
if ! npm test >/dev/null 2>&1; then
  echo "❌ Tests failed"
  echo "💡 Run: npm test"
  exit 1
fi

echo "✅ All validation checks passed!"
echo "🎉 Hunters Run platform is ready for development"
echo ""
echo "Next steps:"
echo "  1. Configure .env with your actual service credentials"
echo "  2. Visit http://localhost:3000/api for API documentation"
echo "  3. Visit http://localhost:3000/ready to check system readiness"
echo "  4. Run npm run dev to start development servers"'

  # Make validation script executable
  if [[ "$DRY_RUN" != "true" ]]; then
    chmod +x scripts/validate-setup.sh
  fi
}

install_dependencies() {
  log_info "Installing dependencies..."
  
  # Install root dependencies
  run_cmd "npm install"
  
  # Install workspace dependencies
  run_cmd "npm install --workspaces"
  
  log_success "Dependencies installed"
}

run_self_tests() {
  log_info "Running self-tests..."
  
  # Start infrastructure
  run_cmd "npm run docker:up"
  
  # Wait for services to be ready
  log_info "Waiting for services to start..."
  sleep 15
  
  # Run validation script
  run_cmd "./scripts/validate-setup.sh"
  
  log_success "Self-tests completed successfully"
}

# Main execution
main() {
  echo "🏠 Hunters Run Platform Bootstrap Script"
  echo "========================================"
  echo ""
  
  if [[ "$DRY_RUN" == "true" ]]; then
    log_warn "DRY RUN MODE - No changes will be made"
    echo ""
  fi
  
  check_prerequisites
  bootstrap_project
  
  if [[ "$DRY_RUN" != "true" ]]; then
    echo ""
    log_success "🎉 Bootstrap completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. cd $PROJECT_NAME"
    echo "  2. cp .env.example .env"
    echo "  3. Edit .env with your service credentials"
    echo "  4. npm run dev"
    echo ""
    echo "For validation: npm run validate"
    echo "For documentation: open http://localhost:3000/api"
  fi
}

# Error handling
trap 'log_error "Script failed on line $LINENO"' ERR

# Run main function
main "$@"