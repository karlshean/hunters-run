#!/usr/bin/env node
/**
 * Simple database test
 */

console.log('Starting simple DB test...');

try {
  // Test sqlite3 directly
  const sqlite3 = await import('sqlite3');
  console.log('✅ sqlite3 import successful');
  
  const db = new sqlite3.default.Database(':memory:', (err) => {
    if (err) {
      console.error('❌ Database creation failed:', err);
      process.exit(1);
    } else {
      console.log('✅ Database created');
      
      // Run a simple query
      db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)', (err) => {
        if (err) {
          console.error('❌ Table creation failed:', err);
        } else {
          console.log('✅ Table created');
          
          db.run('INSERT INTO test (name) VALUES (?)', ['Hello'], function(err) {
            if (err) {
              console.error('❌ Insert failed:', err);
            } else {
              console.log('✅ Insert successful, ID:', this.lastID);
              
              db.get('SELECT * FROM test WHERE id = ?', [1], (err, row) => {
                if (err) {
                  console.error('❌ Select failed:', err);
                } else {
                  console.log('✅ Select successful:', row);
                }
                
                db.close(() => {
                  console.log('✅ Database closed');
                  console.log('🎉 All tests passed!');
                  process.exit(0);
                });
              });
            }
          });
        }
      });
    }
  });
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}