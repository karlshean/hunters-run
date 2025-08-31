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

//
// === BEGIN PREPARE REBIND SHIM ===
// Rebinds the *exported* `prepare` so all importers see normalized statements.
// Avoids local-scope assignment. Adds granular error handling and diagnostics.
(() => {
  // Resolve exports object (CommonJS) without throwing on ESM builds
  const hasCJS = (typeof module !== 'undefined') && module && module.exports;
  const exp = hasCJS ? module.exports : (typeof exports !== 'undefined' ? exports : null);
  if (!exp || typeof exp !== 'object') { return; }

  // Find the original prepare from common export shapes
  const candidates = [];
  if (typeof exp.prepare === 'function') candidates.push(['exports.prepare', exp.prepare]);
  if (exp.default && typeof exp.default.prepare === 'function') candidates.push(['exports.default.prepare', exp.default.prepare]);

  // As a last resort, fall back to a top-level prepare symbol if present
  if (candidates.length === 0 && typeof prepare === 'function') {
    candidates.push(['(top-level) prepare', prepare]);
  }
  if (candidates.length === 0) { if (console && console.warn) console.warn('db-adapter: no prepare() export found'); return; }

  function wrapStmt(stmt) {
    try {
      // Already better-sqlite3-like?
      if (stmt && (typeof stmt.get === 'function' || typeof stmt.run === 'function' || typeof stmt.all === 'function')) {
        return stmt;
      }
      // sqlite3 fallback returns function → expose as get/run/all
      if (typeof stmt === 'function') {
        return {
          get: async (...args) => { try { return await stmt(...args); } catch (e) { if (console && console.error) console.error('db-adapter:get error:', e?.message); throw e; } },
          run: async (...args) => { try { return await stmt(...args); } catch (e) { if (console && console.error) console.error('db-adapter:run error:', e?.message); throw e; } },
          all: async (...args) => { try { return await stmt(...args); } catch (e) { if (console && console.error) console.error('db-adapter:all error:', e?.message); throw e; } },
        };
      }
      return stmt; // unknown shape: leave untouched
    } catch (e) {
      if (console && console.error) console.error('db-adapter:wrapStmt failed:', e?.message);
      return stmt;
    }
  }

  function wrapPrepare(orig, label) {
    return function normalizedPrepare(sql) {
      try {
        const s = orig(sql);
        return wrapStmt(s);
      } catch (e) {
        if (console && console.error) console.error('db-adapter:prepare call failed (' + label + '):', e?.message);
        throw e;
      }
    };
  }

  // Rebind on all found export locations
  for (const [label, orig] of candidates) {
    const wrapped = wrapPrepare(orig, label);
    // Assign back to the same export object so importers see it
    if (label === 'exports.prepare' && hasCJS) {
      exp.prepare = wrapped;
    } else if (label === 'exports.default.prepare' && exp.default) {
      exp.default.prepare = wrapped;
    } else if (label === '(top-level) prepare') {
      // Best-effort: also mirror to module.exports.prepare if absent
      if (hasCJS && typeof exp.prepare !== 'function') exp.prepare = wrapped;
      // Keep local symbol updated if consumers in this file reference it
      try { prepare = wrapped; } catch (_) { /* ignore if not writable */ }
    }
  }

  if (console && console.info) console.info('db-adapter: prepare() normalized → {get,run,all}');
})();
// === END PREPARE REBIND SHIM ===

// Graceful shutdown
process.on('SIGINT', closeDb);
process.on('SIGTERM', closeDb);