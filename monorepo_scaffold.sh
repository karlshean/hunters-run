#!/bin/bash
# File/Folder Tree and Scaffold

# Create complete project structure
mkdir -p hunters-run-platform
cd hunters-run-platform

# Directory structure
mkdir -p {apps/{api,worker},packages/{integrations,shared}}
mkdir -p apps/api/src/{auth,common,database,legal,files,notifications,payments}
mkdir -p apps/api/src/auth/{guards,strategies}
mkdir -p apps/api/src/common/{interceptors,filters,decorators}
mkdir -p apps/api/src/database/{migrations,seeds,entities}
mkdir -p apps/api/src/legal/{templates,notices,service-attempts}
mkdir -p apps/api/test
mkdir -p apps/worker/src/{processors,jobs}
mkdir -p packages/shared/src/{types,utils}
mkdir -p infra

echo "📁 Project structure created:"
tree -a -I 'node_modules|dist|.git' .

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
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "db:migrate": "cd apps/api && npm run typeorm:run",
    "db:seed": "cd apps/api && npm run seed",
    "setup": "npm install && npm run docker:up && sleep 10 && npm run db:migrate && npm run db:seed"
  },
  "devDependencies": {
    "turbo": "^1.11.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0