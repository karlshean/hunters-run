const { Client } = require('pg');

(async () => {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    await client.query('SET ROLE app_user');
    console.log('=== RLS POLICY DEBUG ===');
    
    // Check the actual policy condition for properties
    const policy = await client.query(`
      SELECT policyname, cmd, qual 
      FROM pg_policies 
      WHERE schemaname = 'hr' AND tablename = 'properties'
    `);
    
    console.log('Properties policy condition:', policy.rows[0]?.qual);
    
    // Test if empty string works with current_setting
    console.log('\n=== TESTING EMPTY STRING HANDLING ===');
    await client.query(`SELECT set_config('app.org_id', '', true)`);
    const emptyTest = await client.query(`SELECT current_setting('app.org_id', true) as value`);
    console.log('Empty string value from current_setting:', JSON.stringify(emptyTest.rows[0].value));
    
    // Try casting empty string to UUID
    try {
      const castTest = await client.query(`SELECT ''::uuid as result`);
      console.log('Empty string to UUID works:', castTest.rows[0].result);
    } catch (e) {
      console.log('Empty string UUID cast fails:', e.message);
      
      // Try NULL instead
      try {
        await client.query(`SELECT set_config('app.org_id', NULL, true)`);
        const nullTest = await client.query(`SELECT current_setting('app.org_id', true) as value`);
        console.log('NULL value from current_setting:', JSON.stringify(nullTest.rows[0].value));
        
        const nullCastTest = await client.query(`SELECT (current_setting('app.org_id', true))::uuid as result`);
        console.log('NULL cast to UUID works:', nullCastTest.rows[0].result);
      } catch (nullErr) {
        console.log('NULL handling also fails:', nullErr.message);
        
        // Check what happens with unset variable
        try {
          await client.query(`SELECT reset_config('app.org_id')`);
        } catch (resetErr) {
          // reset_config might not exist, try different approach
        }
        
        const unsetTest = await client.query(`SELECT current_setting('app.org_id', true) as value`);
        console.log('Unset variable value:', JSON.stringify(unsetTest.rows[0].value));
      }
    }
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();