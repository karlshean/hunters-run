#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

class MigrationRunner {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL_MODE === 'strict' ? { rejectUnauthorized: true } : false
    });
    
    this.migrationsDir = path.join(__dirname, '../packages/db/migrations');
  }

  async run() {
    console.log('🔄 Starting database migrations...');
    console.log(`📁 Migrations directory: ${this.migrationsDir}`);

    try {
      // Ensure migrations table exists
      await this.ensureMigrationsTable();

      // Get migration files
      const migrationFiles = this.getMigrationFiles();
      
      if (migrationFiles.length === 0) {
        console.log('✅ No migration files found.');
        return;
      }

      console.log(`📋 Found ${migrationFiles.length} migration files`);

      // Get already applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      console.log(`✅ ${appliedMigrations.size} migrations already applied`);

      // Apply pending migrations
      let applied = 0;
      for (const filename of migrationFiles) {
        if (!appliedMigrations.has(filename)) {
          await this.applyMigration(filename);
          applied++;
        } else {
          console.log(`⏭️  Skipping ${filename} (already applied)`);
        }
      }

      if (applied > 0) {
        console.log(`✅ Applied ${applied} new migrations`);
      } else {
        console.log('✅ All migrations up to date');
      }

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Ensure the migrations tracking table exists
   */
  async ensureMigrationsTable() {
    await this.pool.query(`
      create table if not exists public.migrations (
        id serial primary key,
        filename varchar(255) not null unique,
        applied_at timestamp with time zone not null default now()
      )
    `);
  }

  /**
   * Get migration files in lexicographic order
   */
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      console.log(`⚠️  Migrations directory does not exist: ${this.migrationsDir}`);
      return [];
    }

    return fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Lexicographic order (001, 002, etc.)
  }

  /**
   * Get set of already applied migration filenames
   */
  async getAppliedMigrations() {
    const result = await this.pool.query('select filename from public.migrations');
    return new Set(result.rows.map(row => row.filename));
  }

  /**
   * Apply a single migration file
   */
  async applyMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    
    console.log(`🔄 Applying migration: ${filename}`);
    
    try {
      // Read migration file
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Apply in transaction
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Execute migration SQL
        await client.query(sql);
        
        // Record migration as applied
        await client.query(
          'insert into public.migrations (filename) values ($1)',
          [filename]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Applied migration: ${filename}`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error(`❌ Failed to apply migration ${filename}:`, error);
      throw error;
    }
  }

  /**
   * List migration status
   */
  async status() {
    console.log('📊 Migration Status:');
    
    try {
      await this.ensureMigrationsTable();
      
      const migrationFiles = this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      
      if (migrationFiles.length === 0) {
        console.log('  No migration files found.');
        return;
      }
      
      console.log('');
      migrationFiles.forEach(filename => {
        const status = appliedMigrations.has(filename) ? '✅ Applied' : '⏳ Pending';
        console.log(`  ${status} - ${filename}`);
      });
      
      const pending = migrationFiles.filter(f => !appliedMigrations.has(f)).length;
      console.log('');
      console.log(`📋 Summary: ${appliedMigrations.size} applied, ${pending} pending`);
      
    } catch (error) {
      console.error('❌ Status check failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }
}

// Command line interface
async function main() {
  const command = process.argv[2] || 'migrate';
  
  const runner = new MigrationRunner();
  
  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await runner.run();
        break;
      case 'status':
        await runner.status();
        break;
      default:
        console.log('Usage: node run-sql-migrations.js [migrate|status]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}