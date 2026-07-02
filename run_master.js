const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const password = process.argv[2];
  if (!password) { console.error('Usage: node run_master.js <password>'); process.exit(1); }

  const sql = fs.readFileSync('supabase/MASTER_SETUP.sql', 'utf8');
  const client = new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected. Running MASTER_SETUP.sql ...');
    const res = await client.query(sql);
    const last = Array.isArray(res) ? res[res.length - 1] : res;
    if (last && last.rows && last.rows[0]) console.log('\n✅', last.rows[0].status);
    else console.log('\n✅ Done.');
  } catch (err) {
    console.error('\n❌ Error at step:');
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
