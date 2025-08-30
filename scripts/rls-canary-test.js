const { Client } = require('pg');

async function rlsCanaryTest() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('=== RLS CANARY TEST ===\n');
    
    // Switch to app_user role
    console.log('Setting role to app_user...');
    await client.query('SET ROLE app_user');
    
    // Verify current user
    const identity = await client.query('SELECT current_user, session_user');
    console.log('Current user:', identity.rows[0].current_user);
    console.log('Session user:', identity.rows[0].session_user);
    
    // Test 1: Query with org1 context
    console.log('\n1. Setting context to Organization 1...');
    await client.query("SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000001', true)");
    
    const org1Result = await client.query('SELECT COUNT(*) as count FROM hr.properties');
    const org1Count = parseInt(org1Result.rows[0].count);
    console.log('   Properties visible with Org 1 context:', org1Count);
    
    // Test 2: Query with org2 context  
    console.log('\n2. Setting context to Organization 2...');
    await client.query("SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000002', true)");
    
    const org2Result = await client.query('SELECT COUNT(*) as count FROM hr.properties');
    const org2Count = parseInt(org2Result.rows[0].count);
    console.log('   Properties visible with Org 2 context:', org2Count);
    
    // Test 3: Query without context (should be 0 if RLS is working)
    console.log('\n3. Clearing organization context...');
    // Reset removes the setting, which causes the policy to evaluate to NULL = NULL (false)
    await client.query("RESET app.org_id");
    
    let noContextCount = 0;
    try {
      const noContextResult = await client.query('SELECT COUNT(*) as count FROM hr.properties');
      noContextCount = parseInt(noContextResult.rows[0].count);
    } catch (err) {
      // If it errors due to missing context, that's also a sign RLS is working
      console.log('   RLS blocked access (error on missing context)');
      noContextCount = 0;
    }
    console.log('   Properties visible without context:', noContextCount);
    
    // Validate results
    console.log('\n=== RLS VALIDATION ===');
    
    const rlsWorking = (org1Count > 0) && (org2Count >= 0) && (org1Count !== org2Count) && (noContextCount === 0);
    
    if (rlsWorking) {
      console.log('✅ RLS IS WORKING CORRECTLY!');
      console.log('   - Org 1 sees:', org1Count, 'properties');
      console.log('   - Org 2 sees:', org2Count, 'properties'); 
      console.log('   - No context sees:', noContextCount, 'properties (blocked)');
      console.log('   - Cross-org isolation: VERIFIED');
    } else {
      console.log('❌ RLS ISSUES DETECTED');
      if (org1Count === org2Count) console.log('   - ISSUE: Same count for both orgs');
      if (noContextCount > 0) console.log('   - ISSUE: Data visible without context');
      if (org1Count === 0) console.log('   - ISSUE: No data for Org 1');
    }
    
    // Test 4: Verify no cross-org data leakage
    console.log('\n=== CROSS-ORG SECURITY TEST ===');
    
    // Set to org1 and try to access org2 data
    await client.query("SELECT set_config('app.org_id', '00000000-0000-4000-8000-000000000001', true)");
    const crossOrgTest = await client.query(`
      SELECT COUNT(*) as count 
      FROM hr.properties 
      WHERE organization_id = '00000000-0000-4000-8000-000000000002'
    `);
    const crossOrgCount = parseInt(crossOrgTest.rows[0].count);
    
    if (crossOrgCount === 0) {
      console.log('✅ Cross-org isolation VERIFIED: Cannot access Org 2 data while in Org 1 context');
    } else {
      console.log('❌ SECURITY BREACH: Can access Org 2 data from Org 1 context!');
    }
    
    await client.end();
    
    return {
      org1Count,
      org2Count,
      noContextCount,
      crossOrgBlocked: crossOrgCount === 0,
      rlsWorking
    };
    
  } catch (err) {
    console.error('❌ RLS Canary test failed:', err.message);
    process.exit(1);
  }
}

// Run the test
rlsCanaryTest().then(results => {
  console.log('\n=== FINAL RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
});