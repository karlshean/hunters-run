/* Run SQL migrations in order using pg */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const files = [
  'packages/db/sql/base.sql',
  'packages/db/sql/legal_patch.sql',
  'packages/db/sql/payments_extra.sql'
];

(async () => {
  const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
  const client = new Client({ connectionString: url });
  await client.connect();
  for (const f of files) {
    const p = path.resolve(f);
    if (!fs.existsSync(p)) {
      console.log(`[migrate] skip missing ${p}`);
      continue;
    }
    const sql = fs.readFileSync(p, 'utf8');
    console.log(`[migrate] applying ${p}`);
    await client.query(sql);
  }
  console.log('[migrate] verifying key tables/columns');
  const q = `
    select
      to_regclass('hr.notice_templates') as nt,
      to_regclass('hr.legal_notices') as ln,
      to_regclass('hr.service_attempts') as sa,
      to_regclass('hr.events') as ev
  `;
  const r = await client.query(q);
  const row = r.rows[0] || {};
  if (!row.nt || !row.ln || !row.sa || !row.ev) {
    console.error('❌ required hr.* tables missing'); process.exit(1);
  }
  await client.end();
  console.log('[migrate] done');
})().catch(e => { console.error(e); process.exit(1); });