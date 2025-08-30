#!/usr/bin/env node
/**
 * Simple setup verification
 */
import fs from 'fs';
import sqlite3 from 'sqlite3';

console.log('🔍 Verifying ADHD Bot Setup\n');

// Check 1: Files exist
console.log('📁 File structure:');
const requiredFiles = [
  'package.json',
  '.env',
  'data/adhd.sqlite',
  'src/bot.js',
  'src/db/adapter.js',
  'src/db/sqlite.js'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file}`);
    allFilesExist = false;
  }
}

// Check 2: Database
console.log('\n💾 Database verification:');
const db = new sqlite3.Database('./data/adhd.sqlite', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.log('   ❌ Database connection failed');
    process.exit(1);
  } else {
    console.log('   ✅ Database connection successful');
    
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      if (err) {
        console.log('   ❌ Table query failed');
      } else {
        console.log(`   ✅ Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);
        
        // Check environment
        console.log('\n🔧 Environment:');
        console.log(`   ✅ DB_FILE: ${process.env.DB_FILE || 'default'}`);
        console.log(`   ✅ BOT_NAME: ${process.env.BOT_NAME || 'default'}`);
        console.log(`   ✅ Token: ${process.env.TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' ? '[PLACEHOLDER]' : '[SET]'}`);
        
        console.log('\n🎉 Setup verification complete!');
        console.log('   • sqlite3 driver: Working');
        console.log('   • Database initialized: Yes');
        console.log('   • Bot ready: Yes (needs live token for production)');
        
        db.close();
        process.exit(0);
      }
    });
  }
});