import { Controller, Get } from '@nestjs/common';
import Redis from 'ioredis';
import { Client } from 'pg';

@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { ok: true, service: 'hr-api' };
  }

  @Get('ready')
  async ready() {
    const dbUrl = process.env.DATABASE_URL!;
    const redisUrl = process.env.REDIS_URL!;

    // Postgres check
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    const db = await pg.query('SELECT 1 as ok');
    await pg.end();

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
}
