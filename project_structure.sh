# Project Structure Generation Script
mkdir -p hunters-run-platform
cd hunters-run-platform

# Root configuration
cat > package.json << 'EOF'
{
  "name": "hunters-run-platform",
  "version": "1.0.0",
  "private": true,
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
    "docker:down": "docker-compose down"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "concurrently": "^8.2.0"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
EOF

# Turbo configuration
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF

# Docker Compose
cat > docker-compose.yml << 'EOF'
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
      - ./migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

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
      retries: 5

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
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    command: npm run start:dev

  worker:
    build:
      context: .
      dockerfile: packages/jobs/Dockerfile
    container_name: hunters-run-worker
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/hunters_run
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./packages/jobs:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
EOF

# Environment template
cat > .env.example << 'EOF'
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hunters_run
REDIS_URL=redis://localhost:6379

# Authentication
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# File Storage
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=hunters-run-files

# Email
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx

# SMS
TELNYX_API_KEY=KEY01xxxxxxxxxxxxxxxxxx

# Payments
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=your-jwt-secret-minimum-32-characters
CORS_ORIGIN=http://localhost:3001

# External Services
PAYNEARME_API_KEY=test_xxxxxxxxxxxxxxxxxxxx
VENMO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
EOF

# Create directory structure
mkdir -p {apps/{api,admin,mobile},packages/{common,integrations,jobs},infra,migrations}

# API App Structure
mkdir -p apps/api/src/{auth,common,database,modules/{platform,hunters-run}}
mkdir -p apps/api/src/modules/platform/{users,organizations,files,audit}
mkdir -p apps/api/src/modules/hunters-run/{properties,units,tenants,leases,maintenance,payments,legal}

# Common Package Structure  
mkdir -p packages/common/src/{types,guards,utils,constants}

# Integrations Package Structure
mkdir -p packages/integrations/src/{email,sms,files,payments,auth}

# Jobs Package Structure
mkdir -p packages/jobs/src/{queues,workers,processors}

echo "Project structure created successfully!"
EOF