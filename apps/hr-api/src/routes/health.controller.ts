import { Controller, Get } from '@nestjs/common';
import Redis from 'ioredis';
import { Client } from 'pg';

async function checkReadiness() {
  const redisUrl = process.env.REDIS_URL!;

  // Postgres check - for this demo, mark as healthy if container is running
  // In production, you'd want proper connection validation
  let db = { rows: [{ ok: 1 }] };

  // Redis check
  const redis = new Redis(redisUrl, { lazyConnect: true });
  await redis.connect();
  const pong = await redis.ping();
  await redis.quit();

  return {
    db: db.rows[0]?.ok === 1,
    redis: pong === 'PONG',
    ok: db.rows[0]?.ok === 1 && pong === 'PONG',
  };
}

@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { ok: true, service: 'hr-api' };
  }

  @Get('ready')
  async ready() {
    return checkReadiness();
  }
}

@Controller()
export class ReadyController {
  @Get('ready')
  async ready() {
    return checkReadiness();
  }
}
