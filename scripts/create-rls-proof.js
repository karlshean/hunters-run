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
    
    console.log('=== RLS STANDARDIZATION PROOF ===');
    console.log('Generated:', timestamp);
    console.log('');
    
    // Query all hr.* policies
    const result = await client.query(`
      SELECT 
        tablename,
        policyname,
        cmd,
        qual as using_expression,
        CASE 
          WHEN qual LIKE '%app.org_id%' THEN 'app.org_id'
          WHEN qual LIKE '%app.current_organization%' THEN 'app.current_organization'
          ELSE 'other'
        END as session_variable
      FROM pg_policies 
      WHERE schemaname = 'hr'
      ORDER BY tablename, policyname
    `);
    
    // Create summary statistics
    const stats = {
      total_policies: result.rows.length,
      uses_app_org_id: result.rows.filter(r => r.session_variable === 'app.org_id').length,
      uses_app_current_organization: result.rows.filter(r => r.session_variable === 'app.current_organization').length,
      uses_other: result.rows.filter(r => r.session_variable === 'other').length
    };
    
    console.log('=== SUMMARY ===');
    console.log('Total policies:', stats.total_policies);
    console.log('Using app.org_id:', stats.uses_app_org_id);
    console.log('Using app.current_organization:', stats.uses_app_current_organization);
    console.log('Using other/none:', stats.uses_other);
    console.log('');
    
    // Create table
    console.log('=== POLICY DETAILS ===');
    console.log('Table | Policy | Command | Session Variable');
    console.log('------|--------|---------|------------------');
    result.rows.forEach(row => {
      console.log(`${row.tablename} | ${row.policyname} | ${row.cmd} | ${row.session_variable}`);
    });
    
    // Create proof document
    const proof = {
      timestamp,
      verification_status: 'COMPLETE',
      summary: {
        ...stats,
        all_standardized: stats.uses_app_current_organization === 0,
        standardization_percentage: ((stats.uses_app_org_id / stats.total_policies) * 100).toFixed(1) + '%'
      },
      policies: result.rows.map(row => ({
        table: row.tablename,
        policy: row.policyname,
        command: row.cmd,
        session_variable: row.session_variable,
        expression: row.using_expression
      }))
    };
    
    // Create verification directory
    const docsDir = path.join(process.cwd(), 'docs', 'verification');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    // Write JSON proof
    const jsonPath = path.join(docsDir, 'proof.json');
    fs.writeFileSync(jsonPath, JSON.stringify(proof, null, 2));
    console.log('\nWritten JSON proof to:', jsonPath);
    
    // Write markdown proof
    let markdown = '# RLS Standardization Proof\n\n';
    markdown += `**Generated:** ${timestamp}\n\n`;
    markdown += `**Status:** ${proof.summary.all_standardized ? '✅ FULLY STANDARDIZED' : '⚠️ NEEDS STANDARDIZATION'}\n\n`;
    
    markdown += '## Summary\n\n';
    markdown += `- **Total Policies:** ${stats.total_policies}\n`;
    markdown += `- **Using app.org_id:** ${stats.uses_app_org_id} (${proof.summary.standardization_percentage})\n`;
    markdown += `- **Using app.current_organization:** ${stats.uses_app_current_organization}\n`;
    markdown += `- **Using other/none:** ${stats.uses_other}\n\n`;
    
    markdown += '## Policy Details\n\n';
    markdown += '| Table | Policy | Command | Session Variable |\n';
    markdown += '|-------|--------|---------|------------------|\n';
    result.rows.forEach(row => {
      const icon = row.session_variable === 'app.org_id' ? '✅' : 
                   row.session_variable === 'app.current_organization' ? '❌' : '⚠️';
      markdown += `| ${row.tablename} | ${row.policyname} | ${row.cmd} | ${icon} ${row.session_variable} |\n`;
    });
    
    markdown += '\n## Verification\n\n';
    if (proof.summary.all_standardized) {
      markdown += '✅ **All policies are standardized to use `app.org_id`**\n\n';
      markdown += 'No policies reference the deprecated `app.current_organization` session variable.\n';
    } else {
      markdown += '⚠️ **Some policies still need standardization**\n\n';
      markdown += `Found ${stats.uses_app_current_organization} policies still using \`app.current_organization\`.\n`;
    }
    
    const mdPath = path.join(docsDir, 'proof.md');
    fs.writeFileSync(mdPath, markdown);
    console.log('Written markdown proof to:', mdPath);
    
    await client.end();
    
    // Exit with appropriate code
    process.exit(proof.summary.all_standardized ? 0 : 1);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();