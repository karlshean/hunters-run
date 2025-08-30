const { Client } = require('pg');

async function checkRoles() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'relaxed' ? false : { rejectUnauthorized: true }
  });

  try {
    console.log('🔍 Checking existing database roles...\n');
    
    await client.connect();
    
    // Check if roles exist and their properties
    const result = await client.query(`
      SELECT 
        rolname,
        rolsuper,
        rolcreatedb,
        rolcreaterole,
        rolreplication,
        rolbypassrls,
        rolcanlogin
      FROM pg_roles 
      WHERE rolname IN ('app_user', 'migration_role', 'postgres')
      ORDER BY rolname
    `);
    
    console.log('📋 Current Database Roles:');
    console.log('┌─────────────────┬───────────┬─────────────┬──────────────┬───────────────┬─────────────┬────────────┐');
    console.log('│ Role Name       │ Superuser │ Create DB   │ Create Role  │ Replication   │ Bypass RLS  │ Can Login  │');
    console.log('├─────────────────┼───────────┼─────────────┼──────────────┼───────────────┼─────────────┼────────────┤');
    
    result.rows.forEach(row => {
      console.log(`│ ${row.rolname.padEnd(15)} │ ${row.rolsuper.toString().padEnd(9)} │ ${row.rolcreatedb.toString().padEnd(11)} │ ${row.rolcreaterole.toString().padEnd(12)} │ ${row.rolreplication.toString().padEnd(13)} │ ${row.rolbypassrls.toString().padEnd(11)} │ ${row.rolcanlogin.toString().padEnd(10)} │`);
    });
    console.log('└─────────────────┴───────────┴─────────────┴──────────────┴───────────────┴─────────────┴────────────┘');
    
    // Check if app_user and migration_role exist
    const appUserExists = result.rows.some(row => row.rolname === 'app_user');
    const migrationRoleExists = result.rows.some(row => row.rolname === 'migration_role');
    
    console.log('\n📊 Role Status:');
    console.log('  app_user:', appUserExists ? '✅ EXISTS' : '❌ MISSING');
    console.log('  migration_role:', migrationRoleExists ? '✅ EXISTS' : '❌ MISSING');
    
    if (appUserExists) {
      const appUser = result.rows.find(row => row.rolname === 'app_user');
      const isSecure = !appUser.rolsuper && !appUser.rolbypassrls;
      console.log('  app_user security:', isSecure ? '✅ SECURE (non-privileged)' : '⚠️ PRIVILEGED');
    }
    
    // Test connection as app_user if it exists
    if (appUserExists) {
      console.log('\n🔒 Testing app_user connection...');
      try {
        const testClient = new Client({
          connectionString: 'postgresql://app_user:StrongTempAppUser!123@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
          ssl: false
        });
        
        await testClient.connect();
        const whoami = await testClient.query('SELECT current_user, session_user');
        console.log('  Connection test: ✅ SUCCESS');
        console.log('  Identity:', whoami.rows[0].current_user);
        await testClient.end();
      } catch (err) {
        console.log('  Connection test: ❌ FAILED -', err.message);
      }
    }
    
    await client.end();
    return result.rows;
    
  } catch (error) {
    console.error('❌ Role check failed:', error.message);
    return [];
  }
}

checkRoles();