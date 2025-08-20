#!/bin/bash
# setup-hunters-run.sh - Complete project setup script

set -e

echo "🏠 Setting up Hunters Run Property Management Platform..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Create project structure
echo "📁 Creating project structure..."
mkdir -p hunters-run-platform
cd hunters-run-platform

# Create all directories
mkdir -p {apps/{api,admin,mobile},packages/{common,integrations,jobs},infra,migrations}
mkdir -p apps/api/src/{auth,common,database,modules/{platform,hunters-run}}
mkdir -p apps/api/src/modules/platform/{users,organizations,files,audit}
mkdir -p apps/api/src/modules/hunters-run/{properties,units,tenants,leases,maintenance,payments,legal}
mkdir -p apps/api/src/auth/{guards,decorators,strategies}
mkdir -p apps/api/src/common/{filters,interceptors,pipes}
mkdir -p packages/common/src/{types,guards,utils,constants}
mkdir -p packages/integrations/src/{email,sms,files,payments,auth}
mkdir -p packages/jobs/src/{queues,workers,processors}

echo "📦 Setting up package.json files..."

# Root package.json
cat > package.json << 'EOF'
{
  "name": "hunters-run-platform",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm run api:dev\" \"npm run worker:dev\"",
    "api:dev": "cd apps/api && npm run start:dev",
    "worker:dev": "cd packages/jobs && npm run worker:dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "db:migrate": "cd apps/api && npm run db:migrate",
    "db:seed": "cd apps/api && npm run db:seed",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "docker:reset": "docker-compose down -v && docker-compose up -d"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "concurrently": "^8.2.0"
  }
}
EOF

# API package.json
cat > apps/api/package.json << 'EOF'
{
  "name": "@hunters-run/api",
  "version": "1.0.0",
  "description": "Hunters Run Property Management API",
  "main": "dist/main.js",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "db:migrate": "npm run typeorm migration:run",
    "db:migrate:create": "npm run typeorm migration:generate",
    "db:seed": "ts-node src/database/seeds/run-seeds.ts",
    "typeorm": "typeorm-ts-node-commonjs -d src/database/data-source.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/jwt": "^10.1.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/swagger": "^7.1.0",
    "@nestjs/throttler": "^4.2.0",
    "@nestjs/bull": "^10.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "bull": "^4.11.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.1",
    "firebase-admin": "^11.10.0",
    "aws-sdk": "^2.1400.0",
    "@sendgrid/mail": "^7.7.0",
    "stripe": "^12.15.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "uuid": "^9.0.0",
    "bcrypt": "^5.1.0",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "multer": "^1.4.5",
    "sharp": "^0.32.0",
    "pdf-lib": "^1.17.0",
    "@hunters-run/integrations": "workspace:*",
    "@hunters-run/common": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/supertest": "^2.0.12",
    "@types/pg": "^8.10.0",
    "@types/bcrypt": "^5.0.0",
    "@types/multer": "^1.4.7",
    "@types/uuid": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.42.0",
    "eslint-config-prettier": "^8.8.0",
    "eslint-plugin-prettier": "^4.2.1",
    "jest": "^29.5.0",
    "prettier": "^2.8.8",
    "source-map-support": "^0.5.21",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  }
}
EOF

# Integrations package.json
cat > packages/integrations/package.json << 'EOF'
{
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
    "@sendgrid/mail": "^7.7.0",
    "aws-sdk": "^2.1400.0",
    "stripe": "^12.15.0",
    "firebase-admin": "^11.10.0",
    "axios": "^1.4.0"
  },
  "devDependencies": {
    "typescript": "^5.1.3",
    "@types/node": "^20.3.1",
    "jest": "^29.5.0",
    "@types/jest": "^29.5.2"
  }
}
EOF

# Common package.json
cat > packages/common/package.json << 'EOF'
{
  "name": "@hunters-run/common",
  "version": "1.0.0",
  "description": "Shared types and utilities",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "