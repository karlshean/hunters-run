const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'relaxed' ? { rejectUnauthorized: false } : { rejectUnauthorized: true }
  });

  try {
    await client.connect();
    const timestamp = new Date().toISOString();
    
    console.log('=== WEBHOOK_EVENTS AUDIT ===');
    console.log('Timestamp:', timestamp);
    console.log('');
    
    // Check total rows
    const total = await client.query('SELECT COUNT(*) as count FROM hr.webhook_events');
    console.log('Total rows:', total.rows[0].count);
    
    // Check NULL organization_id rows
    const nullRows = await client.query('SELECT COUNT(*) as count FROM hr.webhook_events WHERE organization_id IS NULL');
    console.log('NULL organization_id rows:', nullRows.rows[0].count);
    
    // Check non-NULL organization_id rows
    const nonNullRows = await client.query('SELECT COUNT(*) as count FROM hr.webhook_events WHERE organization_id IS NOT NULL');
    console.log('Non-NULL organization_id rows:', nonNullRows.rows[0].count);
    
    // Show sample of NULL rows if any
    if (parseInt(nullRows.rows[0].count) > 0) {
      console.log('\nSample NULL rows:');
      const sample = await client.query('SELECT provider, event_id, received_at FROM hr.webhook_events WHERE organization_id IS NULL LIMIT 3');
      sample.rows.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.provider}:${row.event_id} at ${row.received_at}`);
      });
    }
    
    // Check current constraint
    const constraint = await client.query(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'hr' AND table_name = 'webhook_events' AND column_name = 'organization_id'
    `);
    console.log('\nCurrent constraint:');
    console.log('organization_id nullable:', constraint.rows[0].is_nullable);
    
    // Check current policy
    const policy = await client.query(`
      SELECT policyname, qual 
      FROM pg_policies 
      WHERE schemaname = 'hr' AND tablename = 'webhook_events'
    `);
    console.log('\nCurrent RLS policy:');
    if (policy.rows.length > 0) {
      console.log('Policy name:', policy.rows[0].policyname);
      console.log('Policy expression:', policy.rows[0].qual);
      const allowsNull = policy.rows[0].qual.includes('IS NULL');
      console.log('Allows NULL org_id:', allowsNull ? 'YES ⚠️' : 'NO ✅');
    } else {
      console.log('No RLS policy found');
    }
    
    console.log('\n=== STATUS ===');
    const needsCleanup = parseInt(nullRows.rows[0].count) > 0;
    const needsConstraint = constraint.rows[0].is_nullable === 'YES';
    const needsPolicyUpdate = policy.rows.length === 0 || policy.rows[0].qual.includes('IS NULL');
    
    console.log('Needs NULL cleanup:', needsCleanup ? 'YES' : 'NO');
    console.log('Needs NOT NULL constraint:', needsConstraint ? 'YES' : 'NO');
    console.log('Needs policy update:', needsPolicyUpdate ? 'YES' : 'NO');
    
    await client.end();
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();