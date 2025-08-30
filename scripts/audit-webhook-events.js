const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
    
    // 1. Count total rows
    const totalResult = await client.query('SELECT COUNT(*) as count FROM hr.webhook_events');
    const totalRows = parseInt(totalResult.rows[0].count);
    console.log('Total rows:', totalRows);
    
    // 2. Count NULL organization_id rows
    const nullResult = await client.query('SELECT COUNT(*) as count FROM hr.webhook_events WHERE organization_id IS NULL');
    const nullRows = parseInt(nullResult.rows[0].count);
    console.log('Rows with NULL organization_id:', nullRows);
    
    // 3. Count non-NULL organization_id rows
    const nonNullResult = await client.query('SELECT COUNT(*) as count FROM hr.webhook_events WHERE organization_id IS NOT NULL');
    const nonNullRows = parseInt(nonNullResult.rows[0].count);
    console.log('Rows with valid organization_id:', nonNullRows);
    
    // 4. Get sample of NULL rows if any exist
    let nullRowsSample = [];
    if (nullRows > 0) {
      console.log('\n=== NULL ORGANIZATION_ID ROWS ===');
      const sampleResult = await client.query(`
        SELECT id, event_type, created_at, webhook_id 
        FROM hr.webhook_events 
        WHERE organization_id IS NULL 
        LIMIT 5
      `);
      nullRowsSample = sampleResult.rows;
      console.log('Sample (up to 5):');
      sampleResult.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Type: ${row.event_type}, Created: ${row.created_at}`);
      });
    }
    
    // 5. Check current column constraint
    const constraintResult = await client.query(`
      SELECT 
        column_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'hr' 
        AND table_name = 'webhook_events'
        AND column_name = 'organization_id'
    `);
    
    const columnInfo = constraintResult.rows[0];
    console.log('\n=== COLUMN CONSTRAINTS ===');
    console.log('Column:', columnInfo.column_name);
    console.log('Nullable:', columnInfo.is_nullable);
    console.log('Default:', columnInfo.column_default || 'none');
    
    // 6. Check current RLS policy
    const policyResult = await client.query(`
      SELECT 
        policyname,
        cmd,
        qual as using_expression
      FROM pg_policies
      WHERE schemaname = 'hr' 
        AND tablename = 'webhook_events'
    `);
    
    console.log('\n=== CURRENT RLS POLICY ===');
    if (policyResult.rows.length > 0) {
      const policy = policyResult.rows[0];
      console.log('Policy name:', policy.policyname);
      console.log('Command:', policy.cmd);
      console.log('Expression:', policy.using_expression);
      const allowsNull = policy.using_expression.includes('IS NULL');
      console.log('Allows NULL:', allowsNull ? 'YES ⚠️' : 'NO ✅');
    }
    
    // 7. Decision on what to do
    console.log('\n=== RECOMMENDED ACTION ===');
    if (nullRows > 0) {
      console.log(`Found ${nullRows} rows with NULL organization_id`);
      console.log('Action: DELETE these rows (system-level events should not bypass RLS)');
      
      // Get a valid org_id for potential backfill
      const orgResult = await client.query('SELECT DISTINCT organization_id FROM hr.webhook_events WHERE organization_id IS NOT NULL LIMIT 1');
      if (orgResult.rows.length > 0) {
        console.log('Alternative: Could backfill to org:', orgResult.rows[0].organization_id);
      }
    } else {
      console.log('✅ No NULL organization_id rows found');
      console.log('Safe to add NOT NULL constraint');
    }
    
    // Create audit report
    const auditReport = {
      timestamp,
      table: 'hr.webhook_events',
      audit: {
        total_rows: totalRows,
        null_organization_id_rows: nullRows,
        valid_organization_id_rows: nonNullRows,
        null_rows_sample: nullRowsSample
      },
      column_info: columnInfo,
      current_policy: policyResult.rows[0] || null,
      recommendation: nullRows > 0 ? 'DELETE_NULL_ROWS' : 'ADD_NOT_NULL_CONSTRAINT',
      status: nullRows === 0 ? 'READY' : 'NEEDS_CLEANUP'
    };
    
    // Save audit report
    const docsDir = path.join(process.cwd(), 'docs', 'verification');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    const auditPath = path.join(docsDir, 'webhook-events-audit.json');
    fs.writeFileSync(auditPath, JSON.stringify(auditReport, null, 2));
    console.log('\nAudit report saved to:', auditPath);
    
    await client.end();
    process.exit(nullRows > 0 ? 1 : 0);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();