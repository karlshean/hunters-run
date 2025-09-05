import { Pool, PoolClient } from 'pg';
import { config } from '../config/environment';

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: config.DB_SSL_MODE === 'strict' ? { rejectUnauthorized: true } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async one<T = any>(text: string, params?: any[]): Promise<T> {
    const rows = await this.query<T>(text, params);
    if (rows.length === 0) {
      throw new Error('Expected one row, but got none');
    }
    if (rows.length > 1) {
      throw new Error(`Expected one row, but got ${rows.length}`);
    }
    return rows[0];
  }

  async oneOrNull<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    if (rows.length === 0) {
      return null;
    }
    if (rows.length > 1) {
      throw new Error(`Expected one or no rows, but got ${rows.length}`);
    }
    return rows[0];
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}