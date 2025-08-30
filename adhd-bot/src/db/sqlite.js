import DatabaseAdapter from './adapter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { info, error } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = process.env.DB_FILE || './data/adhd.sqlite';

let db = null;

export async function openDb() {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    info(`Created data directory: ${dataDir}`);
  }

  try {
    db = new DatabaseAdapter(DB_FILE);
    
    // Log which driver is being used
    const driverInfo = db.getDriverInfo();
    info(`Database opened with ${driverInfo.driver}: ${DB_FILE}`);
    
    // Enable foreign keys if using better-sqlite3
    if (!driverInfo.isAsync) {
      await db.run('PRAGMA foreign_keys = ON');
    }
    
    return db;
  } catch (err) {
    error('Failed to open database:', err);
    throw err;
  }
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
    info('Database closed');
  }
}

// Prepared statements cache
const statements = new Map();

export async function prepare(sql) {
  if (!db) await openDb();
  
  if (!statements.has(sql)) {
    statements.set(sql, db.prepare(sql));
  }
  return statements.get(sql);
}

// Transaction helper
export async function transaction(fn) {
  if (!db) await openDb();
  return await db.transaction(fn);
}

// Backup helper - simplified for adapter compatibility
export async function backup(destPath) {
  if (!db) await openDb();
  
  try {
    // For adapter compatibility, we'll copy the file
    fs.copyFileSync(DB_FILE, destPath);
    info(`Database backed up to: ${destPath}`);
    return true;
  } catch (err) {
    error('Backup failed:', err);
    return false;
  }
}

// Graceful shutdown
process.on('SIGINT', closeDb);
process.on('SIGTERM', closeDb);