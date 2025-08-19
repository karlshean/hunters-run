# HR-API - Hunters Run API Service

## Quick Start

### Prerequisites
- Node.js 20.x
- Docker Desktop
- npm 10.x

### Setup & Run

1. **Start Docker services:**
```bash
docker compose up -d
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run the API:**
```bash
npm run dev:hr
```

The API will be available at http://localhost:3000

### Endpoints

- `GET /api/health` - Basic health check
- `GET /api/ready` - Readiness probe (checks DB and Redis connections)

### Expected Response

**`/api/health`:**
```json
{
  "ok": true,
  "service": "hr-api"
}
```

**`/api/ready`:**
```json
{
  "db": "ok",
  "redis": "ok"
}
```

### Known Issues

- **Windows Docker Desktop**: Postgres authentication may fail due to Docker networking issues on Windows. Redis connections work correctly. This is a known issue with Docker Desktop on Windows and host networking.

### Development Scripts

From project root:
- `npm run dev:hr` - Start API in watch mode
- `npm run build:hr` - Build the API
- `npm run start:hr` - Start built API

### Environment Variables

Copy `.env.example` to `.env` and update as needed:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/unified
REDIS_URL=redis://localhost:6379
PORT=3000
```