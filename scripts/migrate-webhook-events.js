const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'relaxed' ? { rejectUnauthorized: false } : { rejectUnauthorized: true }
  });

  try {
    await client.connect();
    const timestamp = new Date().toISOString();
    
    console.log('=== WEBHOOK_EVENTS MIGRATION ===');
    console.log('Timestamp:', timestamp);
    console.log('');
    
    // Start transaction
    await client.query('BEGIN');
    console.log('Transaction started');
    
    try {
      // Step 1: Delete any NULL organization_id rows (defensive, should be 0)
      console.log('\n1. Cleaning NULL organization_id rows...');
      const deleteResult = await client.query('DELETE FROM hr.webhook_events WHERE organization_id IS NULL');
      console.log(`   Deleted ${deleteResult.rowCount} rows with NULL organization_id`);
      
      // Step 2: Add NOT NULL constraint
      console.log('\n2. Adding NOT NULL constraint...');
      await client.query('ALTER TABLE hr.webhook_events ALTER COLUMN organization_id SET NOT NULL');
      console.log('   ✅ NOT NULL constraint added');
      
      // Step 3: Drop existing RLS policy
      console.log('\n3. Dropping existing RLS policy...');
      await client.query('DROP POLICY IF EXISTS p_we ON hr.webhook_events');
      console.log('   ✅ Old policy dropped');
      
      // Step 4: Create new strict RLS policy
      console.log('\n4. Creating strict RLS policy...');
      await client.query(`
        CREATE POLICY p_we ON hr.webhook_events
        FOR ALL
        USING (organization_id = (current_setting('app.org_id'::text, true))::uuid)
        WITH CHECK (organization_id = (current_setting('app.org_id'::text, true))::uuid)
      `);
      console.log('   ✅ New strict policy created');
      
      // Step 5: Verify the changes
      console.log('\n5. Verifying changes...');
      
      // Check constraint
      const constraintCheck = await client.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'hr' 
          AND table_name = 'webhook_events' 
          AND column_name = 'organization_id'
      `);
      const isNullable = constraintCheck.rows[0].is_nullable;
      console.log(`   Column nullable: ${isNullable} (should be NO)`);
      
      // Check new policy
      const policyCheck = await client.query(`
        SELECT qual 
        FROM pg_policies 
        WHERE schemaname = 'hr' 
          AND tablename = 'webhook_events'
      `);
      const newExpression = policyCheck.rows[0]?.qual || 'NOT FOUND';
      const hasNullCheck = newExpression.includes('IS NULL');
      console.log(`   Policy allows NULL: ${hasNullCheck ? 'YES ⚠️' : 'NO ✅'}`);
      
      // Validation
      if (isNullable === 'NO' && !hasNullCheck) {
        console.log('\n✅ MIGRATION SUCCESSFUL');
        await client.query('COMMIT');
        console.log('Transaction committed');
      } else {
        throw new Error('Verification failed - rolling back');
      }
      
    } catch (err) {
      console.error('\n❌ Migration failed:', err.message);
      await client.query('ROLLBACK');
      console.log('Transaction rolled back');
      throw err;
    }
    
    // Final status report
    console.log('\n=== FINAL STATUS ===');
    const finalCheck = await client.query(`
      SELECT 
        c.is_nullable,
        p.qual as policy_expression
      FROM information_schema.columns c
      CROSS JOIN pg_policies p
      WHERE c.table_schema = 'hr' 
        AND c.table_name = 'webhook_events'
        AND c.column_name = 'organization_id'
        AND p.schemaname = 'hr'
        AND p.tablename = 'webhook_events'
    `);
    
    if (finalCheck.rows.length > 0) {
      const status = finalCheck.rows[0];
      console.log('organization_id nullable:', status.is_nullable);
      console.log('RLS policy:', status.policy_expression);
      console.log('Strict enforcement:', status.is_nullable === 'NO' && !status.policy_expression.includes('IS NULL') ? '✅ YES' : '❌ NO');
    }
    
    await client.end();
    console.log('\n✅ Migration complete');
    process.exit(0);
    
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
})();