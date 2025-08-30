/**
 * Database Adapter - Auto-fallback from better-sqlite3 to sqlite3
 * Provides uniform sync-like interface regardless of underlying driver
 */

let DatabaseClass = null;
let isAsyncDriver = false;
let driverDetected = false;

async function detectDriver() {
  if (driverDetected) return;
  
  // Try better-sqlite3 first, fallback to sqlite3
  try {
    DatabaseClass = (await import('better-sqlite3')).default;
    isAsyncDriver = false;
    console.log('✅ Using better-sqlite3 (sync driver)');
  } catch (error) {
    try {
      const sqlite3Module = await import('sqlite3');
      DatabaseClass = sqlite3Module.default.Database;
      isAsyncDriver = true;
      console.log('✅ Using sqlite3 fallback (async driver)');
    } catch (fallbackError) {
      throw new Error(`No SQLite driver available. Install either better-sqlite3 or sqlite3: ${fallbackError.message}`);
    }
  }
  
  driverDetected = true;
}

class DatabaseAdapter {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.ready = false;
    this.initPromise = this.init(options);
  }
  
  async init(options = {}) {
    await detectDriver();
    
    return new Promise((resolve, reject) => {
      if (isAsyncDriver) {
        // sqlite3 setup
        this.db = new DatabaseClass(this.dbPath, (err) => {
          if (err) {
            console.error('SQLite3 connection error:', err);
            reject(err);
          } else {
            this.ready = true;
            resolve();
          }
        });
      } else {
        // better-sqlite3 setup
        try {
          this.db = new DatabaseClass(this.dbPath, options);
          this.db.pragma('journal_mode = WAL');
          this.ready = true;
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    });
  }
  
  async ensureReady() {
    if (!this.ready) {
      await this.initPromise;
    }
  }

  // Unified interface methods
  async run(sql, params = []) {
    await this.ensureReady();
    
    if (isAsyncDriver) {
      // Convert sqlite3 async to promise
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes, lastInsertRowid: this.lastID });
        });
      });
    } else {
      // better-sqlite3 is sync
      return this.db.prepare(sql).run(params);
    }
  }

  async get(sql, params = []) {
    await this.ensureReady();
    
    if (isAsyncDriver) {
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    } else {
      return this.db.prepare(sql).get(params);
    }
  }

  async all(sql, params = []) {
    await this.ensureReady();
    
    if (isAsyncDriver) {
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    } else {
      return this.db.prepare(sql).all(params);
    }
  }

  prepare(sql) {
    // Return async wrapper for both drivers
    return {
      run: async (params = []) => await this.run(sql, params),
      get: async (params = []) => await this.get(sql, params),
      all: async (params = []) => await this.all(sql, params)
    };
  }

  async exec(sql) {
    await this.ensureReady();
    
    if (isAsyncDriver) {
      return new Promise((resolve, reject) => {
        this.db.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      return this.db.exec(sql);
    }
  }

  async close() {
    await this.ensureReady();
    
    if (isAsyncDriver) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      return this.db.close();
    }
  }

  // Helper methods for consistency
  async transaction(fn) {
    await this.ensureReady();
    
    if (isAsyncDriver) {
      // Basic transaction support for sqlite3
      try {
        await this.run('BEGIN');
        const result = await fn();
        await this.run('COMMIT');
        return result;
      } catch (error) {
        await this.run('ROLLBACK');
        throw error;
      }
    } else {
      // better-sqlite3 native transactions
      return this.db.transaction(fn)();
    }
  }

  // Info about active driver
  getDriverInfo() {
    return {
      driver: isAsyncDriver ? 'sqlite3' : 'better-sqlite3',
      isAsync: isAsyncDriver,
      path: this.dbPath
    };
  }
}

export { DatabaseAdapter, isAsyncDriver };
export default DatabaseAdapter;