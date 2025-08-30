#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';

console.log('=== DATABASE RESTORE TOOL ===');
console.log('Generated:', new Date().toISOString());
console.log();

const RESTORE_DATABASE_URL = process.env.RESTORE_DATABASE_URL;
const backupFile = process.argv[2];

if (!RESTORE_DATABASE_URL) {
  console.error('❌ RESTORE_DATABASE_URL required');
  console.error('   Example: RESTORE_DATABASE_URL=postgresql://user:pass@host:port/scratch_db');
  process.exit(1);
}

// Find backup file
let targetBackup;
if (backupFile) {
  if (!existsSync(backupFile)) {
    console.error(`❌ Backup file not found: ${backupFile}`);
    process.exit(1);
  }
  targetBackup = backupFile;
} else {
  // Use latest backup
  const backupDir = join(process.cwd(), 'backups');
  if (!existsSync(backupDir)) {
    console.error('❌ No backups directory found');
    process.exit(1);
  }
  
  const backups = readdirSync(backupDir)
    .filter(f => f.endsWith('.sql') && f.includes('hunters-run-backup'))
    .sort()
    .reverse();
    
  if (backups.length === 0) {
    console.error('❌ No backup files found');
    process.exit(1);
  }
  
  targetBackup = join(backupDir, backups[0]);
}

// Parse database URLs (mask passwords)
const restoreUrl = new URL(RESTORE_DATABASE_URL);
const maskedRestoreUrl = `${restoreUrl.protocol}//${restoreUrl.username}:*****@${restoreUrl.hostname}:${restoreUrl.port}${restoreUrl.pathname}`;

console.log(`📁 Backup file: ${basename(targetBackup)}`);
console.log(`🎯 Restore target: ${maskedRestoreUrl}`);
console.log();

try {
  const startTime = Date.now();
  
  console.log('🔄 Starting database restore...');
  console.log('⚠️  This will DROP and recreate the target database');
  
  // Execute restore
  const restoreCommand = `psql "${RESTORE_DATABASE_URL}" -f "${targetBackup}"`;
  
  console.log('📦 Executing psql restore...');
  const output = execSync(restoreCommand, { 
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8'
  });
  
  const duration = Date.now() - startTime;
  const durationSeconds = (duration / 1000).toFixed(1);
  
  console.log('✅ Restore completed successfully');
  console.log(`⏱️  Duration: ${durationSeconds} seconds`);
  
  // Verify restoration by checking table counts
  console.log();
  console.log('🔍 Verifying restoration...');
  
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: RESTORE_DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'relaxed' ? { rejectUnauthorized: false } : { rejectUnauthorized: true }
  });
  
  await client.connect();
  
  // Check schema and table counts
  const schemas = await client.query(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name IN ('hr', 'platform', 'audit')
    ORDER BY schema_name
  `);
  
  console.log(`📊 Schemas restored: ${schemas.rows.length}/3`);
  schemas.rows.forEach(row => {
    console.log(`   ✅ ${row.schema_name}`);
  });
  
  // Check table counts in each schema
  for (const schema of schemas.rows) {
    try {
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
        ORDER BY table_name
      `, [schema.schema_name]);
      
      console.log(`📋 Tables in ${schema.schema_name}: ${tables.rows.length}`);
      
      // Get row counts for key tables
      if (schema.schema_name === 'hr') {
        const props = await client.query('SELECT COUNT(*) as count FROM hr.properties');
        const orders = await client.query('SELECT COUNT(*) as count FROM hr.work_orders');
        console.log(`   properties: ${props.rows[0].count} rows`);
        console.log(`   work_orders: ${orders.rows[0].count} rows`);
      }
      
    } catch (error) {
      console.log(`   ⚠️ Could not verify ${schema.schema_name}: ${error.message}`);
    }
  }
  
  await client.end();
  
  // Create restore report
  const report = {
    timestamp: new Date().toISOString(),
    restore: {
      backupFile: targetBackup,
      targetDatabase: maskedRestoreUrl,
      durationMs: duration,
      success: true
    },
    verification: {
      schemasRestored: schemas.rows.length,
      schemas: schemas.rows.map(r => r.schema_name)
    }
  };
  
  const reportFile = join(process.cwd(), 'backups', `restore-report-${new Date().toISOString().split('T')[0]}.json`);
  require('fs').writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📝 Report: ${reportFile}`);
  
  console.log();
  console.log('🎉 Restore drill completed successfully');
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Restore failed:', error.message);
  
  const errorReport = {
    timestamp: new Date().toISOString(),
    restore: {
      backupFile: targetBackup,
      targetDatabase: maskedRestoreUrl,
      success: false,
      error: error.message
    }
  };
  
  const errorFile = join(process.cwd(), 'backups', `restore-error-${new Date().toISOString().split('T')[0]}.json`);
  require('fs').writeFileSync(errorFile, JSON.stringify(errorReport, null, 2));
  console.log(`📝 Error report: ${errorFile}`);
  
  process.exit(1);
}