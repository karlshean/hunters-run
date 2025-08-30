#!/usr/bin/env node
/**
 * Compatibility smoke test for database adapter
 */
import fs from 'fs';
import path from 'path';
import DatabaseAdapter from './src/db/adapter.js';

async function smokeTest() {
  console.log('🔍 Starting database adapter smoke test...\n');
  
  const testDbPath = './data/test-adhd.sqlite';
  const testDataDir = path.dirname(testDbPath);
  
  try {
    // Ensure data directory exists
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
      console.log(`✅ Created test directory: ${testDataDir}`);
    }
    
    // Test 1: Create database instance
    console.log('1️⃣ Creating database instance...');
    const db = new DatabaseAdapter(testDbPath);
    const driverInfo = db.getDriverInfo();
    console.log(`   ✅ Using driver: ${driverInfo.driver} (async: ${driverInfo.isAsync})`);
    
    // Test 2: Create table
    console.log('2️⃣ Creating test table...');
    const createSQL = `
      CREATE TABLE IF NOT EXISTS test_table (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `;
    await db.exec(createSQL);
    console.log('   ✅ Table created successfully');
    
    // Test 3: Insert data
    console.log('3️⃣ Inserting test data...');
    const insertResult = await db.run('INSERT INTO test_table (name) VALUES (?)', ['Test User']);
    console.log('   ✅ Insert successful:', insertResult);
    
    // Test 4: Query data
    console.log('4️⃣ Querying test data...');
    const row = await db.get('SELECT * FROM test_table WHERE name = ?', ['Test User']);
    console.log('   ✅ Query successful:', row);
    
    // Test 5: Query all data
    console.log('5️⃣ Querying all data...');
    const rows = await db.all('SELECT * FROM test_table');
    console.log(`   ✅ Found ${rows.length} rows`);
    
    // Test 6: Prepared statement
    console.log('6️⃣ Testing prepared statement...');
    const stmt = db.prepare('SELECT COUNT(*) as count FROM test_table');
    const countResult = await stmt.get();
    console.log('   ✅ Prepared statement result:', countResult);
    
    // Test 7: Close database
    console.log('7️⃣ Closing database...');
    await db.close();
    console.log('   ✅ Database closed');
    
    // Cleanup
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('   ✅ Test database cleaned up');
    }
    
    console.log('\n🎉 All tests PASSED! Database adapter is working correctly.');
    console.log(`📊 Driver used: ${driverInfo.driver}`);
    console.log(`📁 Database path: ${testDbPath}`);
    
    return { 
      success: true, 
      driver: driverInfo.driver,
      async: driverInfo.isAsync 
    };
    
  } catch (error) {
    console.error('❌ Smoke test FAILED:', error.message);
    console.error('Stack:', error.stack);
    
    // Cleanup on failure
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  smokeTest().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

export { smokeTest };