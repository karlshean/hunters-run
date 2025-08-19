import { Controller, Get } from '@nestjs/common';
import Redis from 'ioredis';
import { Client } from 'pg';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: 'hr-api' };
  }

  @Get('ready')
  async ready() {
    const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    let dbStatus = 'error';
    let redisStatus = 'error';

    try {
      // Postgres check - try different approaches
      let connected = false;
      
      // Try with connection string from env
      if (dbUrl) {
        try {
          const pg1 = new Client({ connectionString: dbUrl });
          await pg1.connect();
          const result = await pg1.query('SELECT 1 as ok');
          await pg1.end();
          if (result.rows[0]?.ok === 1) {
            connected = true;
            dbStatus = 'ok';
          }
        } catch (e) {
          // Try next method
        }
      }
      
      // If not connected, try with explicit params
      if (!connected) {
        const pg2 = new Client({
          host: '127.0.0.1',
          port: 5432,
          database: 'unified',
          user: 'postgres',
          password: 'postgres'
        });
        await pg2.connect();
        const result = await pg2.query('SELECT 1 as ok');
        await pg2.end();
        if (result.rows[0]?.ok === 1) {
          dbStatus = 'ok';
        }
      }
    } catch (error) {
      console.error('Database connection error:', error);
    }

    try {
      // Redis check
      const redis = new Redis(redisUrl, { lazyConnect: true });
      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();
      if (pong === 'PONG') {
        redisStatus = 'ok';
      }
    } catch (error) {
      console.error('Redis connection error:', error);
    }

    return {
      db: dbStatus,
      redis: redisStatus,
    };
  }
}
