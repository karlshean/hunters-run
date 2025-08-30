import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { openDb, closeDb } from '../src/db/sqlite.js';
import { success, error, info } from '../src/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    info('Starting database migrations...');
    
    // Open database
    const db = await openDb();
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    info(`Found ${files.length} migration files`);
    
    // Run each migration
    for (const file of files) {
      info(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await db.exec(sql);
        success(`✓ ${file} completed`);
      } catch (err) {
        error(`✗ ${file} failed:`, err.message);
        throw err;
      }
    }
    
    success('All migrations completed successfully!');
    
  } catch (err) {
    error('Migration failed:', err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };