import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { openDb, closeDb } from '../src/db/sqlite.js';
import { success, error, info } from '../src/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeeds() {
  try {
    info('Starting database seeding...');
    
    // Open database
    const db = openDb();
    
    // Get all seed files
    const seedsDir = path.join(__dirname, '../seeds');
    const files = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    info(`Found ${files.length} seed files`);
    
    // Run each seed
    for (const file of files) {
      info(`Running seed: ${file}`);
      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
      
      try {
        db.exec(sql);
        success(`✓ ${file} completed`);
      } catch (err) {
        error(`✗ ${file} failed:`, err.message);
        // Continue with other seeds even if one fails
      }
    }
    
    success('Database seeding completed!');
    
  } catch (err) {
    error('Seeding failed:', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeds();
}

export { runSeeds };