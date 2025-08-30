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
    
    console.log('=== FINAL RLS AUDIT - ALL HR.* POLICIES ===');
    console.log('Timestamp:', timestamp);
    console.log('');
    
    // Query all policies in hr schema
    const result = await client.query(`
      SELECT 
        tablename,
        policyname,
        cmd,
        qual as using_expression,
        with_check as check_expression,
        CASE 
          WHEN qual LIKE '%app.org_id%' THEN 'app.org_id'
          WHEN qual LIKE '%app.current_organization%' THEN 'app.current_organization'
          WHEN qual IS NULL THEN 'none'
          ELSE 'other'
        END as session_variable,
        CASE 
          WHEN with_check LIKE '%app.org_id%' THEN 'app.org_id'
          WHEN with_check LIKE '%app.current_organization%' THEN 'app.current_organization'
          WHEN with_check IS NULL THEN 'none'
          ELSE 'other'
        END as check_session_variable
      FROM pg_policies 
      WHERE schemaname = 'hr'
      ORDER BY tablename, policyname
    `);
    
    console.log('Total policies found:', result.rows.length);
    console.log('');
    
    // Display table
    console.log('| Table | Policy | Command | Using Predicate Session Var | Check Predicate Session Var |');
    console.log('|-------|--------|---------|------------------------------|------------------------------|');
    
    let needsMigration = [];
    
    result.rows.forEach(row => {
      const usingVar = row.session_variable;
      const checkVar = row.check_session_variable;
      
      // Check if migration needed
      if (usingVar === 'app.current_organization' || checkVar === 'app.current_organization') {
        needsMigration.push(row);
      }
      
      const usingIcon = usingVar === 'app.org_id' ? '✅' : 
                        usingVar === 'app.current_organization' ? '❌' : 
                        usingVar === 'other' ? '⚠️' : '➖';
      const checkIcon = checkVar === 'app.org_id' ? '✅' : 
                        checkVar === 'app.current_organization' ? '❌' : 
                        checkVar === 'other' ? '⚠️' : '➖';
      
      console.log(`| ${row.tablename} | ${row.policyname} | ${row.cmd} | ${usingIcon} ${usingVar} | ${checkIcon} ${checkVar} |`);
    });
    
    console.log('');
    console.log('=== ANALYSIS ===');
    
    // Count by session variable
    const stats = {
      using_app_org_id: result.rows.filter(r => r.session_variable === 'app.org_id').length,
      using_app_current_organization: result.rows.filter(r => r.session_variable === 'app.current_organization').length,
      using_other: result.rows.filter(r => r.session_variable === 'other').length,
      using_none: result.rows.filter(r => r.session_variable === 'none').length,
      check_app_org_id: result.rows.filter(r => r.check_session_variable === 'app.org_id').length,
      check_app_current_organization: result.rows.filter(r => r.check_session_variable === 'app.current_organization').length,
      check_other: result.rows.filter(r => r.check_session_variable === 'other').length,
      check_none: result.rows.filter(r => r.check_session_variable === 'none').length
    };
    
    console.log('Using Predicates:');
    console.log('  app.org_id:', stats.using_app_org_id);
    console.log('  app.current_organization:', stats.using_app_current_organization);
    console.log('  other:', stats.using_other);
    console.log('  none:', stats.using_none);
    
    console.log('\nCheck Predicates:');
    console.log('  app.org_id:', stats.check_app_org_id);
    console.log('  app.current_organization:', stats.check_app_current_organization);
    console.log('  other:', stats.check_other);
    console.log('  none:', stats.check_none);
    
    // Check if migration needed
    console.log('\n=== MIGRATION NEEDED? ===');
    if (needsMigration.length > 0) {
      console.log(`❌ YES - Found ${needsMigration.length} policies using app.current_organization`);
      console.log('\nPolicies needing migration:');
      needsMigration.forEach(p => {
        console.log(`  - ${p.tablename}.${p.policyname} (${p.cmd})`);
      });
    } else {
      console.log('✅ NO - All policies use app.org_id or other valid patterns');
    }
    
    // Create audit report
    const auditReport = {
      timestamp,
      total_policies: result.rows.length,
      statistics: stats,
      policies: result.rows.map(r => ({
        table: r.tablename,
        policy: r.policyname,
        command: r.cmd,
        using_session_var: r.session_variable,
        check_session_var: r.check_session_variable,
        using_expression: r.using_expression,
        check_expression: r.check_expression,
        needs_migration: r.session_variable === 'app.current_organization' || r.check_session_variable === 'app.current_organization'
      })),
      migration_needed: needsMigration.length > 0,
      policies_needing_migration: needsMigration.map(p => ({
        table: p.tablename,
        policy: p.policyname,
        command: p.cmd,
        current_using: p.using_expression,
        current_check: p.check_expression
      })),
      fully_standardized: stats.using_app_current_organization === 0 && stats.check_app_current_organization === 0
    };
    
    // Save report
    const docsDir = path.join(process.cwd(), 'docs', 'verification');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    const jsonPath = path.join(docsDir, 'final-rls-audit.json');
    fs.writeFileSync(jsonPath, JSON.stringify(auditReport, null, 2));
    console.log('\nAudit report saved to:', jsonPath);
    
    await client.end();
    
    // Exit with appropriate code
    process.exit(auditReport.fully_standardized ? 0 : 1);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();