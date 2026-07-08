const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB successfully!\n');

    console.log('--- RLS Policies on public.fee_payments ---');
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'fee_payments';
    `);
    console.log(JSON.stringify(policiesRes.rows, null, 2));

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await client.end();
  }
}

run();
