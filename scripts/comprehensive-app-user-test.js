const { Client } = require('pg');

async function comprehensiveTest() {
  // Use postgres connection to test app_user via SET ROLE (pooler workaround)
  const client = new Client({
    connectionString: 'postgresql://postgres.rsmiyfqgqheorwvkokvx:3ph1hBsoj59ZOkNp1@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
    ssl: false
  });

  try {
    console.log('🔒 COMPREHENSIVE APP_USER SECURITY TEST\n');
    
    await client.connect();
    console.log('✅ Connected to database as postgres');
    
    // Switch to app_user role
    console.log('⚡ Switching to app_user role...');
    await client.query('SET ROLE app_user');
    
    // === WHOAMI TEST ===
    console.log('\n📋 IDENTITY VERIFICATION:');
    const identity = await client.query(`
      SELECT 
        current_user,
        session_user,
        current_setting('is_superuser') as is_superuser,
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) as rolsuper,
        (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as rolbypassrls
    `);
    
    const whoami = identity.rows[0];
    console.log('  current_user:', whoami.current_user);
    console.log('  session_user:', whoami.session_user);
    console.log('  is_superuser:', whoami.is_superuser);
    console.log('  rolsuper:', whoami.rolsuper);
    console.log('  rolbypassrls:', whoami.rolbypassrls);
    
    const isSecure = whoami.current_user === 'app_user' && 
                     whoami.rolsuper === false && 
                     whoami.rolbypassrls === false;
    
    console.log('  Security Status:', isSecure ? '✅ SECURE' : '❌ INSECURE');
    
    // === RLS CANARY TEST ===
    console.log('\n🛡️ RLS CANARY TEST:');
    
    // Test Org 1
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000001', true)");
    const org1Result = await client.query('SELECT COUNT(*) AS org1_count FROM hr.properties');
    const org1Count = parseInt(org1Result.rows[0].org1_count);
    console.log('  Organization 1 properties:', org1Count);
    
    // Test Org 2
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000002', true)");
    const org2Result = await client.query('SELECT COUNT(*) AS org2_count FROM hr.properties');
    const org2Count = parseInt(org2Result.rows[0].org2_count);
    console.log('  Organization 2 properties:', org2Count);
    
    // Test no context - set to invalid UUID to trigger RLS blocking
    let noContextCount = 0;
    try {
      await client.query("SELECT set_config('app.org_id','invalid-uuid', true)");
      const noContextResult = await client.query('SELECT COUNT(*) AS count FROM hr.properties');
      noContextCount = parseInt(noContextResult.rows[0].count);
    } catch (err) {
      console.log('  No context: Access blocked by RLS (invalid UUID)');
    }
    console.log('  No organization context:', noContextCount);
    
    // Cross-org security test
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000001', true)");
    const crossOrgResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM hr.properties 
      WHERE organization_id = '00000000-0000-4000-8000-000000000002'
    `);
    const crossOrgCount = parseInt(crossOrgResult.rows[0].count);
    console.log('  Cross-org access:', crossOrgCount === 0 ? '✅ BLOCKED' : '❌ ALLOWED');
    
    // Validate RLS is working
    const rlsWorking = org1Count > 0 && 
                       org2Count >= 0 && 
                       org1Count !== org2Count && 
                       noContextCount === 0 && 
                       crossOrgCount === 0;
    
    console.log('\n🎯 TEST RESULTS:');
    console.log('  Identity Security: ', isSecure ? '✅ PASS' : '❌ FAIL');
    console.log('  RLS Enforcement:   ', rlsWorking ? '✅ PASS' : '❌ FAIL');
    console.log('  Overall Status:    ', (isSecure && rlsWorking) ? '✅ SECURE' : '❌ INSECURE');
    
    await client.end();
    
    return {
      whoami,
      org1Count,
      org2Count,
      noContextCount,
      crossOrgBlocked: crossOrgCount === 0,
      isSecure,
      rlsWorking,
      overallPass: isSecure && rlsWorking
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (client._connected) {
      await client.end();
    }
    return null;
  }
}

// Run the test
comprehensiveTest().then(results => {
  if (results) {
    console.log('\n📊 SUMMARY DATA:');
    console.log(JSON.stringify({
      current_user: results.whoami.current_user,
      rolsuper: results.whoami.rolsuper,
      rolbypassrls: results.whoami.rolbypassrls,
      org1Count: results.org1Count,
      org2Count: results.org2Count,
      secure: results.overallPass
    }, null, 2));
    
    process.exit(results.overallPass ? 0 : 1);
  } else {
    process.exit(1);
  }
});