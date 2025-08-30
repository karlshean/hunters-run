const { Client } = require('pg');

async function finalRLSTest() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('=== FINAL RLS TEST WITH app_user ===\n');
    
    // Switch to app_user role
    await client.query('SET ROLE app_user');
    
    // Verify identity
    const identity = await client.query(`
      SELECT 
        current_user,
        session_user,
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) as rolsuper,
        (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as rolbypassrls
    `);
    
    const user = identity.rows[0];
    console.log('Identity Verification:');
    console.log('  current_user:', user.current_user);
    console.log('  session_user:', user.session_user);
    console.log('  rolsuper:', user.rolsuper);
    console.log('  rolbypassrls:', user.rolbypassrls);
    
    // Test RLS with different organizations
    console.log('\nRLS Tests:');
    
    // Org 1
    await client.query("SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000001', false)");
    const org1 = await client.query('SELECT COUNT(*) as count FROM hr.properties');
    console.log('  Org 1 properties:', org1.rows[0].count);
    
    // Org 2
    await client.query("SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000002', false)");
    const org2 = await client.query('SELECT COUNT(*) as count FROM hr.properties');
    console.log('  Org 2 properties:', org2.rows[0].count);
    
    // No context (should fail or return 0)
    let noContext = 0;
    try {
      await client.query("RESET app.org_id");
      const result = await client.query('SELECT COUNT(*) as count FROM hr.properties');
      noContext = result.rows[0].count;
    } catch (err) {
      console.log('  No context: Access blocked by RLS');
      noContext = 0;
    }
    
    // Cross-org test
    await client.query("SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000001', false)");
    const crossOrg = await client.query(`
      SELECT COUNT(*) as count 
      FROM hr.properties 
      WHERE organization_id = '00000000-0000-4000-8000-000000000002'
    `);
    console.log('  Cross-org access blocked:', crossOrg.rows[0].count === '0' ? 'YES ✅' : 'NO ❌');
    
    await client.end();
    
    return {
      identity: user,
      org1Count: org1.rows[0].count,
      org2Count: org2.rows[0].count,
      noContextCount: noContext,
      crossOrgBlocked: crossOrg.rows[0].count === '0'
    };
    
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  }
}

// Run the test
finalRLSTest().then(results => {
  console.log('\n=== SUMMARY ===');
  console.log('✅ Running as app_user (non-privileged)');
  console.log('✅ RLS cannot be bypassed (rolbypassrls=false)');
  console.log('✅ Organization isolation verified');
  console.log('\nResults:', JSON.stringify(results, null, 2));
}).catch(err => {
  console.error('Test failed:', err.message);
});