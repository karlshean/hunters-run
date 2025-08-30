const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'relaxed' ? { rejectUnauthorized: false } : { rejectUnauthorized: true }
  });

  try {
    await client.connect();
    console.log('=== CHECKING FOR app.current_organization REFERENCES ===\n');
    
    // Query for policies using app.current_organization
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        cmd,
        qual as using_expression,
        with_check as check_expression
      FROM pg_policies 
      WHERE schemaname = 'hr'
        AND (qual LIKE '%app.current_organization%' 
             OR with_check LIKE '%app.current_organization%')
      ORDER BY tablename, policyname
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ No policies found using app.current_organization');
      console.log('All hr.* policies already use app.org_id');
    } else {
      console.log('⚠️ Found ' + result.rows.length + ' policies still using app.current_organization:\n');
      result.rows.forEach(row => {
        console.log('Table: ' + row.tablename);
        console.log('Policy: ' + row.policyname);
        console.log('Command: ' + row.cmd);
        console.log('Using: ' + (row.using_expression || 'N/A'));
        console.log('Check: ' + (row.check_expression || 'N/A'));
        console.log('---');
      });
    }
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();