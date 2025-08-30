const { Client } = require('pg');

const client = new Client({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL_MODE === 'relaxed' ? false : { rejectUnauthorized: true }
});

(async () => {
  try {
    await client.connect();
    
    // Check if app_user role exists
    const result = await client.query('SELECT rolname, rolcanlogin, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1', ['app_user']);
    
    if (result.rows.length > 0) {
      console.log('✅ app_user role exists:');
      console.log('  - Can login:', result.rows[0].rolcanlogin);
      console.log('  - Superuser:', result.rows[0].rolsuper);
      console.log('  - Bypass RLS:', result.rows[0].rolbypassrls);
    } else {
      console.log('❌ app_user role does not exist');
      
      // Create it
      console.log('Creating app_user role...');
      await client.query("CREATE ROLE app_user WITH LOGIN PASSWORD 'app_secure_2025'");
      await client.query('GRANT CONNECT ON DATABASE postgres TO app_user');
      await client.query('GRANT USAGE ON SCHEMA hr, platform, audit TO app_user');
      await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hr TO app_user');
      await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO app_user');
      await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA audit TO app_user');
      await client.query('GRANT USAGE ON ALL SEQUENCES IN SCHEMA hr, platform TO app_user');
      console.log('✅ app_user created with necessary permissions');
    }
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();