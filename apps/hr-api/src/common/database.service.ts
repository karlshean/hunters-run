import { Injectable } from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class DatabaseService {
  private readonly connectionString: string;

  constructor() {
    this.connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
  }

  async getClient(): Promise<Client> {
    const client = new Client({ connectionString: this.connectionString });
    await client.connect();
    return client;
  }

  async executeWithOrgContext<T>(
    orgId: string,
    operation: (client: Client) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      // Set RLS context
      await client.query('SET LOCAL app.current_org = $1', [orgId]);
      
      // Execute operation
      return await operation(client);
    } finally {
      await client.end();
    }
  }
}