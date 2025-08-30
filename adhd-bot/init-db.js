#!/usr/bin/env node
/**
 * Simple database initialization
 */
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const DB_FILE = './data/adhd.sqlite';
const MIGRATIONS_DIR = './migrations';

async function initDatabase() {
  console.log('🔧 Initializing database...');
  
  // Ensure data directory exists
  const dataDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`✅ Created directory: ${dataDir}`);
  }
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) {
        console.error('❌ Database creation failed:', err);
        reject(err);
        return;
      }
      
      console.log('✅ Database connected');
      
      // Get migration files
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      console.log(`📋 Found ${files.length} migration files`);
      
      // Run migrations sequentially
      let completed = 0;
      
      function runNextMigration() {
        if (completed >= files.length) {
          db.close((err) => {
            if (err) {
              console.error('❌ Database close error:', err);
              reject(err);
            } else {
              console.log('✅ Database closed');
              console.log('🎉 Database initialization complete!');
              resolve();
            }
          });
          return;
        }
        
        const file = files[completed];
        console.log(`⚙️ Running migration: ${file}`);
        
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        
        db.exec(sql, (err) => {
          if (err) {
            console.error(`❌ Migration ${file} failed:`, err.message);
            db.close();
            reject(err);
          } else {
            console.log(`✅ Migration ${file} completed`);
            completed++;
            runNextMigration();
          }
        });
      }
      
      runNextMigration();
    });
  });
}

// Run initialization
initDatabase().catch(err => {
  console.error('❌ Initialization failed:', err);
  process.exit(1);
});