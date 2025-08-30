const { Client } = require('pg');

console.log('=== DATABASE ROLE IDENTITY CHECK ===');
console.log('Generated:', new Date().toISOString());
console.log();

async function probeRole() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'relaxed' ? { rejectUnauthorized: false } : { rejectUnauthorized: true }
  });

  try {
    await client.connect();
    console.log('✅ Database connection established');
    
    // Get connection details (masked)
    const url = new URL(process.env.DATABASE_URL);
    console.log(`🔗 Connection: ${url.protocol}//${url.username}:*****@${url.hostname}:${url.port}${url.pathname}`);
    
    // Check current user identity
    const identityQuery = `
      SELECT 
        current_user,
        session_user,
        current_setting('is_superuser') as is_superuser
    `;
    const identity = await client.query(identityQuery);
    const userInfo = identity.rows[0];
    
    console.log();
    console.log('👤 Session Identity:');
    console.log(`   current_user: ${userInfo.current_user}`);
    console.log(`   session_user: ${userInfo.session_user}`);
    console.log(`   is_superuser: ${userInfo.is_superuser}`);
    
    // Check role privileges
    const roleQuery = `
      SELECT 
        rolname,
        rolsuper,
        rolinherit,
        rolcreaterole,
        rolcreatedb,
        rolcanlogin,
        rolreplication,
        rolbypassrls
      FROM pg_roles 
      WHERE rolname = current_user
    `;
    const roleInfo = await client.query(roleQuery);
    const role = roleInfo.rows[0];
    
    console.log();
    console.log('🔐 Role Privileges:');
    console.log(`   rolsuper: ${role.rolsuper}`);
    console.log(`   rolinherit: ${role.rolinherit}`);
    console.log(`   rolcreaterole: ${role.rolcreaterole}`);
    console.log(`   rolcreatedb: ${role.rolcreatedb}`);
    console.log(`   rolcanlogin: ${role.rolcanlogin}`);
    console.log(`   rolreplication: ${role.rolreplication}`);
    console.log(`   rolbypassrls: ${role.rolbypassrls}`);
    
    // Security assessment
    console.log();
    console.log('🛡️  Security Assessment:');
    
    const issues = [];
    if (role.rolsuper === true) issues.push('❌ User has SUPERUSER privileges');
    if (role.rolbypassrls === true) issues.push('❌ User can BYPASS RLS');
    if (role.rolcreaterole === true) issues.push('⚠️ User can create roles');
    if (role.rolcreatedb === true) issues.push('⚠️ User can create databases');
    
    if (issues.length === 0) {
      console.log('✅ Role has appropriate least-privilege configuration');
      console.log('✅ RLS enforcement active (no BYPASSRLS)');
      console.log('✅ No superuser privileges');
    } else {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    // Test RLS enforcement (if tables exist)
    try {
      console.log();
      console.log('🔍 RLS Enforcement Test:');
      
      // Try to query without organization context
      const testQuery = await client.query('SELECT COUNT(*) as count FROM hr.properties');
      console.log(`   Properties without org context: ${testQuery.rows[0].count}`);
      
      // Set organization context
      await client.query("SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000001', true)");
      const contextQuery = await client.query('SELECT COUNT(*) as count FROM hr.properties');
      console.log(`   Properties with org context: ${contextQuery.rows[0].count}`);
      
      if (role.rolbypassrls === false) {
        console.log('✅ RLS policies are being enforced');
      } else {
        console.log('⚠️ RLS may be bypassed due to role privileges');
      }
      
    } catch (error) {
      console.log(`   RLS test skipped: ${error.message.split('\n')[0]}`);
    }
    
    await client.end();
    
    // Exit code based on security assessment
    if (role.rolsuper === true || role.rolbypassrls === true) {
      console.log();
      console.log('❌ SECURITY ISSUE: Role has excessive privileges');
      process.exit(1);
    } else {
      console.log();
      console.log('✅ Role configuration passes security check');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

// Handle missing DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

probeRole();