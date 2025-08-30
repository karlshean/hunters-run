#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('=== DATABASE BACKUP TOOL ===');
console.log('Generated:', new Date().toISOString());
console.log();

const DATABASE_URL = process.env.DATABASE_URL || process.env.MIGRATION_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or MIGRATION_DATABASE_URL required');
  process.exit(1);
}

// Parse database URL (mask password in logs)
const dbUrl = new URL(DATABASE_URL);
const maskedUrl = `${dbUrl.protocol}//${dbUrl.username}:*****@${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`;
console.log(`📁 Backup target: ${maskedUrl}`);

// Create backup directory
const backupDir = join(process.cwd(), 'backups');
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

// Generate backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const backupFile = join(backupDir, `hunters-run-backup-${timestamp}.sql`);

try {
  console.log('🔄 Starting database backup...');
  
  // Use pg_dump with specific options for application data
  const dumpCommand = `pg_dump "${DATABASE_URL}" \
    --verbose \
    --clean \
    --create \
    --if-exists \
    --schema=hr \
    --schema=platform \
    --schema=audit \
    --exclude-table-data=audit.events \
    --file="${backupFile}"`;
    
  console.log('📦 Executing pg_dump...');
  execSync(dumpCommand, { 
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8'
  });
  
  // Get backup file stats
  const stats = require('fs').statSync(backupFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log('✅ Backup completed successfully');
  console.log(`📄 Backup file: ${backupFile}`);
  console.log(`💾 Size: ${sizeMB} MB`);
  console.log(`🕒 Created: ${stats.mtime.toISOString()}`);
  
  // Create backup manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    database: {
      host: dbUrl.hostname,
      port: dbUrl.port,
      database: dbUrl.pathname.slice(1)
    },
    backup: {
      file: backupFile,
      sizeMB: parseFloat(sizeMB),
      schemas: ['hr', 'platform', 'audit'],
      excludedTables: ['audit.events'],
      created: stats.mtime.toISOString()
    },
    verification: {
      fileExists: existsSync(backupFile),
      sizeBytes: stats.size
    }
  };
  
  const manifestFile = join(backupDir, `backup-manifest-${timestamp}.json`);
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(`📋 Manifest: ${manifestFile}`);
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Backup failed:', error.message);
  
  // Log error details for troubleshooting
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: error.message,
    command: 'pg_dump',
    database: maskedUrl
  };
  
  const errorFile = join(backupDir, `backup-error-${timestamp}.json`);
  writeFileSync(errorFile, JSON.stringify(errorLog, null, 2));
  console.log(`📝 Error log: ${errorFile}`);
  
  process.exit(1);
}