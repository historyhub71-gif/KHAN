const { Client } = require('pg');

async function run() {
  const password = process.argv[2] || 'ag0bFxd1NY6laSOI';
  const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected. Querying notification_type distinct values...');
    const res = await client.query('SELECT DISTINCT notification_type FROM public.notifications');
    console.log('Distinct values:', res.rows.map(r => r.notification_type));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
