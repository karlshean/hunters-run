const { Client } = require('pg');
const fs = require('fs');

async function setupRoles() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'relaxed' ? false : { rejectUnauthorized: true }
  });

  try {
    console.log('🔧 Setting up database roles...\n');
    
    await client.connect();
    console.log('✅ Connected to database');
    
    // Read the SQL file
    const sql = fs.readFileSync('./scripts/setup-app-roles.sql', 'utf8');
    
    // Execute the role setup
    const result = await client.query(sql);
    console.log('✅ Role setup SQL executed');
    
    // The last query in the SQL file is the verification query
    // Extract role verification results
    console.log('\n📋 Role Verification:');
    console.log('┌─────────────────┬───────────┬─────────────┬──────────────┬───────────────┬─────────────┬────────────┐');
    console.log('│ Role Name       │ Superuser │ Create DB   │ Create Role  │ Replication   │ Bypass RLS  │ Can Login  │');
    console.log('├─────────────────┼───────────┼─────────────┼──────────────┼───────────────┼─────────────┼────────────┤');
    
    // The result array contains all query results - the last one is our verification query
    const verificationResults = result[result.length - 1];
    if (verificationResults && verificationResults.rows) {
      verificationResults.rows.forEach(row => {
        console.log(`│ ${row.rolname.padEnd(15)} │ ${row.rolsuper.toString().padEnd(9)} │ ${row.rolcreatedb.toString().padEnd(11)} │ ${row.rolcreaterole.toString().padEnd(12)} │ ${row.rolreplication.toString().padEnd(13)} │ ${row.rolbypassrls.toString().padEnd(11)} │ ${row.rolcanlogin.toString().padEnd(10)} │`);
      });
    }
    console.log('└─────────────────┴───────────┴─────────────┴──────────────┴───────────────┴─────────────┴────────────┘');
    
    await client.end();
    console.log('\n🎉 Database roles setup complete!');
    return true;
    
  } catch (error) {
    console.error('❌ Role setup failed:', error.message);
    if (client._connected) {
      await client.end();
    }
    return false;
  }
}

setupRoles().then(success => {
  process.exit(success ? 0 : 1);
});