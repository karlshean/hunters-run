import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { openDb, backup as dbBackup, closeDb } from '../src/db/sqlite.js';
import { success, error, info } from '../src/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createBackup() {
  try {
    info('Starting database backup...');
    
    // Create backups directory if it doesn't exist
    const backupsDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(backupsDir, `adhd-bot-${timestamp}.sqlite`);
    
    // Open database
    openDb();
    
    // Create backup
    const result = dbBackup(backupFile);
    
    if (result) {
      // Get file size
      const stats = fs.statSync(backupFile);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      success(`Backup created successfully!`);
      info(`File: ${backupFile}`);
      info(`Size: ${sizeMB} MB`);
      
      // Clean old backups (keep last 10)
      cleanOldBackups(backupsDir, 10);
    } else {
      throw new Error('Backup failed');
    }
    
  } catch (err) {
    error('Backup failed:', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

function cleanOldBackups(dir, keepCount) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('adhd-bot-') && f.endsWith('.sqlite'))
      .map(f => ({
        name: f,
        path: path.join(dir, f),
        time: fs.statSync(path.join(dir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
        info(`Deleted old backup: ${file.name}`);
      });
    }
  } catch (err) {
    error('Failed to clean old backups:', err.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createBackup();
}

export { createBackup };