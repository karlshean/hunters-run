const { Client } = require('pg');

async function simpleSecurityTest() {
  const client = new Client({
    connectionString: 'postgresql://postgres.rsmiyfqgqheorwvkokvx:3ph1hBsoj59ZOkNp1@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
    ssl: false
  });

  try {
    console.log('🔒 APP_USER SECURITY VERIFICATION\n');
    
    await client.connect();
    await client.query('SET ROLE app_user');
    
    // Identity check
    const identity = await client.query(`
      SELECT 
        current_user,
        session_user,
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) as rolsuper,
        (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as rolbypassrls
    `);
    
    const user = identity.rows[0];
    console.log('IDENTITY VERIFICATION:');
    console.log('  current_user:', user.current_user);
    console.log('  session_user:', user.session_user);
    console.log('  rolsuper:', user.rolsuper);
    console.log('  rolbypassrls:', user.rolbypassrls);
    
    // RLS tests
    console.log('\nRLS CANARY TEST:');
    
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000001', true)");
    const org1 = await client.query('SELECT COUNT(*) AS org1_count FROM hr.properties');
    const org1Count = parseInt(org1.rows[0].org1_count);
    console.log('  org1_count:', org1Count);
    
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000002', true)");
    const org2 = await client.query('SELECT COUNT(*) AS org2_count FROM hr.properties');
    const org2Count = parseInt(org2.rows[0].org2_count);
    console.log('  org2_count:', org2Count);
    
    // Cross-org test
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000001', true)");
    const crossOrg = await client.query(`
      SELECT COUNT(*) as count 
      FROM hr.properties 
      WHERE organization_id = '00000000-0000-4000-8000-000000000002'
    `);
    const crossOrgBlocked = crossOrg.rows[0].count === '0';
    console.log('  cross_org_blocked:', crossOrgBlocked);
    
    const isSecure = user.current_user === 'app_user' && 
                     user.rolsuper === false && 
                     user.rolbypassrls === false;
    
    const rlsWorking = org1Count > 0 && org2Count >= 0 && org1Count !== org2Count && crossOrgBlocked;
    
    console.log('\nSUMMARY:');
    console.log('  Identity secure:', isSecure ? '✅ PASS' : '❌ FAIL');
    console.log('  RLS working:', rlsWorking ? '✅ PASS' : '❌ FAIL');
    console.log('  Overall:', (isSecure && rlsWorking) ? '✅ SECURE' : '❌ INSECURE');
    
    await client.end();
    
    return {
      user,
      org1Count,
      org2Count,
      crossOrgBlocked,
      isSecure,
      rlsWorking
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

simpleSecurityTest();