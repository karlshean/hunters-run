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
    console.log('=== RLS POLICY INVENTORY FOR HR SCHEMA ===\n');
    
    // Query pg_policies for all policies in hr schema
    const result = await client.query(`
      SELECT 
        tablename as table_name,
        policyname as policy_name,
        cmd as policy_command,
        qual as using_expression,
        with_check as check_expression,
        permissive,
        roles
      FROM pg_policies 
      WHERE schemaname = 'hr'
      ORDER BY tablename, policyname
    `);
    
    if (result.rows.length === 0) {
      console.log('No RLS policies found in hr schema');
      await client.end();
      return;
    }
    
    // Process and analyze each policy
    const policies = result.rows.map(row => {
      const mentions_app_org_id = row.using_expression ? 
        row.using_expression.includes('app.org_id') : false;
      const mentions_app_current_organization = row.using_expression ? 
        row.using_expression.includes('app.current_organization') : false;
      
      return {
        table_name: row.table_name,
        policy_name: row.policy_name,
        policy_command: row.policy_command,
        using_expression: row.using_expression || null,
        check_expression: row.check_expression || null,
        mentions_app_org_id: mentions_app_org_id ? 'yes' : 'no',
        mentions_app_current_organization: mentions_app_current_organization ? 'yes' : 'no',
        permissive: row.permissive,
        roles: Array.isArray(row.roles) ? row.roles : [row.roles]
      };
    });
    
    // Output in table format for console
    console.log('Table Name | Policy Name | Command | Mentions app.org_id | Mentions app.current_organization');
    console.log('-----------|-------------|---------|---------------------|-----------------------------------');
    policies.forEach(p => {
      console.log(`${p.table_name} | ${p.policy_name} | ${p.policy_command} | ${p.mentions_app_org_id} | ${p.mentions_app_current_organization}`);
    });
    
    console.log('\n=== DETAILED POLICY INFORMATION ===\n');
    policies.forEach(p => {
      console.log(`Table: ${p.table_name}`);
      console.log(`Policy: ${p.policy_name}`);
      console.log(`Command: ${p.policy_command}`);
      console.log(`Permissive: ${p.permissive}`);
      console.log(`Roles: ${p.roles.join(', ')}`);
      console.log(`Using Expression: ${p.using_expression || 'N/A'}`);
      console.log(`Check Expression: ${p.check_expression || 'N/A'}`);
      console.log(`Mentions app.org_id: ${p.mentions_app_org_id}`);
      console.log(`Mentions app.current_organization: ${p.mentions_app_current_organization}`);
      console.log('---\n');
    });
    
    // Create docs/verification directory if it doesn't exist
    const docsDir = path.join(process.cwd(), 'docs', 'verification');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    // Generate markdown report
    let markdown = '# RLS Policy Inventory\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += '## Summary Table\n\n';
    markdown += '| Table Name | Policy Name | Command | Mentions app.org_id | Mentions app.current_organization |\n';
    markdown += '|------------|-------------|---------|---------------------|-----------------------------------|\n';
    
    policies.forEach(p => {
      markdown += `| ${p.table_name} | ${p.policy_name} | ${p.policy_command} | ${p.mentions_app_org_id} | ${p.mentions_app_current_organization} |\n`;
    });
    
    markdown += '\n## Detailed Policy Information\n\n';
    
    policies.forEach(p => {
      markdown += `### ${p.table_name} - ${p.policy_name}\n\n`;
      markdown += `- **Command**: ${p.policy_command}\n`;
      markdown += `- **Permissive**: ${p.permissive}\n`;
      markdown += `- **Roles**: ${p.roles.join(', ')}\n`;
      markdown += `- **Using Expression**: \`${p.using_expression || 'N/A'}\`\n`;
      markdown += `- **Check Expression**: \`${p.check_expression || 'N/A'}\`\n`;
      markdown += `- **References app.org_id**: ${p.mentions_app_org_id}\n`;
      markdown += `- **References app.current_organization**: ${p.mentions_app_current_organization}\n`;
      markdown += '\n';
    });
    
    // Write markdown file
    const mdPath = path.join(docsDir, 'rls-inventory.md');
    fs.writeFileSync(mdPath, markdown);
    console.log(`\nWritten markdown report to: ${mdPath}`);
    
    // Write JSON file
    const jsonPath = path.join(docsDir, 'rls-inventory.json');
    fs.writeFileSync(jsonPath, JSON.stringify(policies, null, 2));
    console.log(`Written JSON report to: ${jsonPath}`);
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();