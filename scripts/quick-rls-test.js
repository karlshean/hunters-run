const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: 'postgresql://postgres.rsmiyfqgqheorwvkokvx:3ph1hBsoj59ZOkNp1@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
    ssl: false
  });

  try {
    await client.connect();
    await client.query('SET ROLE app_user');
    
    // Quick RLS test
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000001', false)");
    const org1 = await client.query('SELECT COUNT(*) FROM hr.properties');
    
    await client.query("SELECT set_config('app.org_id','00000000-0000-4000-8000-000000000002', false)");
    const org2 = await client.query('SELECT COUNT(*) FROM hr.properties');
    
    console.log('org1_count:', org1.rows[0].count);
    console.log('org2_count:', org2.rows[0].count);
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();