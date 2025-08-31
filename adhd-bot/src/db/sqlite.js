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

//
// === BEGIN PREPARE NORMALIZE SHIM ===
// This wraps the existing prepare(sql) so that the returned statement
// always has .get/.run/.all methods (like better-sqlite3).
// If the original returns an async function (sqlite3 fallback), we adapt it.
(() => {
  try {
    // Capture the current binding
    const __origPrepare__ = (typeof prepare === 'function') ? prepare : null;
    if (!__origPrepare__) { return; }

    function __wrapStmt__(stmt) {
      // If it already looks like a better-sqlite3 statement, keep as-is
      if (stmt && (typeof stmt.get === 'function' || typeof stmt.run === 'function' || typeof stmt.all === 'function')) {
        return stmt;
      }
      // If fallback returns an async function, expose it under get/run/all
      if (typeof stmt === 'function') {
        return {
          get: async (...args) => await stmt(...args),
          run: async (...args) => await stmt(...args),
          all: async (...args) => await stmt(...args),
        };
      }
      return stmt;
    }

    // Rebind prepare to normalize returned statements
    prepare = function(sql) {
      const s = __origPrepare__(sql);
      return __wrapStmt__(s);
    };
  } catch (e) {
    // Non-fatal; leave original behavior if anything unexpected happens
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('prepare() normalize shim failed:', e && e.message);
    }
  }
})();
// === END PREPARE NORMALIZE SHIM ===

// Graceful shutdown
process.on('SIGINT', closeDb);
process.on('SIGTERM', closeDb);