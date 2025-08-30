const { Client } = require('pg');

// Test app_user connection
async function testAppUser() {
  const client = new Client({ 
    connectionString: 'postgresql://app_user:app_secure_2025@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
    ssl: false
  });

  try {
    console.log('Attempting to connect as app_user...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Run whoami query
    const result = await client.query(`
      SELECT 
        current_user,
        session_user,
        current_setting('is_superuser') as is_superuser,
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) as rolsuper,
        (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as rolbypassrls
    `);
    
    const identity = result.rows[0];
    console.log('\n=== IDENTITY ===');
    console.log('current_user:', identity.current_user);
    console.log('session_user:', identity.session_user);
    console.log('is_superuser:', identity.is_superuser);
    console.log('rolsuper:', identity.rolsuper);
    console.log('rolbypassrls:', identity.rolbypassrls);
    
    await client.end();
    return identity;
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    
    // Try alternate approach - connect as postgres and switch role
    console.log('\nTrying alternate approach: SET ROLE...');
    const adminClient = new Client({ 
      connectionString: process.env.ADMIN_DATABASE_URL,
      ssl: false
    });
    
    try {
      await adminClient.connect();
      await adminClient.query('SET ROLE app_user');
      
      const result = await adminClient.query(`
        SELECT 
          current_user,
          session_user,
          current_setting('is_superuser') as is_superuser
      `);
      
      const identity = result.rows[0];
      console.log('\n=== IDENTITY (via SET ROLE) ===');
      console.log('current_user:', identity.current_user);
      console.log('session_user:', identity.session_user);
      console.log('is_superuser:', identity.is_superuser);
      
      await adminClient.end();
      return identity;
    } catch (err2) {
      console.error('❌ SET ROLE also failed:', err2.message);
      process.exit(1);
    }
  }
}

testAppUser();