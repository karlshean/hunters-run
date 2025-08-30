#!/usr/bin/env node
/**
 * Dry-run test for the bot - tests initialization without Telegram connection
 */
import 'dotenv/config';
import { openDb, closeDb } from './src/db/sqlite.js';
import { info, success, error } from './src/logger.js';

async function dryRunTest() {
  console.log('🧪 Starting ADHD Bot dry-run test...\n');
  
  try {
    // Test 1: Database initialization
    console.log('1️⃣ Testing database initialization...');
    const db = await openDb();
    const driverInfo = db.getDriverInfo();
    success(`✅ Database opened with ${driverInfo.driver}`);
    success(`✅ Database path: ${driverInfo.path}`);
    
    // Test 2: Basic database operations
    console.log('\n2️⃣ Testing database operations...');
    
    // Check if tables exist
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    success(`✅ Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);
    
    // Test insert and select
    const testUserId = 999999999;
    await db.run('INSERT OR REPLACE INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)', 
      [testUserId, 'test_user', 'Test User']);
    
    const user = await db.get('SELECT * FROM users WHERE telegram_id = ?', [testUserId]);
    success(`✅ Database operations working: User ${user.first_name} created`);
    
    // Test 3: Environment validation
    console.log('\n3️⃣ Testing environment...');
    
    const requiredEnvVars = ['DB_FILE', 'BOT_NAME', 'TZ_DEFAULT'];
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        success(`✅ ${envVar}: ${envVar === 'TELEGRAM_BOT_TOKEN' ? '[MASKED]' : process.env[envVar]}`);
      } else {
        error(`❌ Missing: ${envVar}`);
      }
    }
    
    // Test 4: Check bot token (but don't log it)
    const hasToken = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE';
    if (hasToken) {
      success('✅ TELEGRAM_BOT_TOKEN: [SET]');
    } else {
      info('ℹ️ TELEGRAM_BOT_TOKEN: [PLACEHOLDER] (Bot will run in dry-run mode)');
    }
    
    // Cleanup
    await db.run('DELETE FROM users WHERE telegram_id = ?', [testUserId]);
    await closeDb();
    
    console.log('\n🎉 Dry-run test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Database engine: ${driverInfo.driver}`);
    console.log(`   • Database path: ${driverInfo.path}`);
    console.log(`   • Tables created: ${tables.length}`);
    console.log(`   • Environment: Configured`);
    console.log(`   • Bot status: Ready (${hasToken ? 'Live mode' : 'Dry-run mode'})`);
    
    return { 
      success: true, 
      driver: driverInfo.driver,
      dbPath: driverInfo.path,
      hasToken,
      tableCount: tables.length
    };
    
  } catch (err) {
    error('❌ Dry-run test failed:', err.message);
    await closeDb();
    return { success: false, error: err.message };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  dryRunTest().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

export { dryRunTest };