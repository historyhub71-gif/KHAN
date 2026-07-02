const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // Run the complete_approved_student_signup RPC for lango@gmail.com
    console.log('Calling complete_approved_student_signup...');
    const res = await client.query(
      `SELECT public.complete_approved_student_signup($1, $2, $3)`,
      ['lango@gmail.com', 'TestPassword123!', 'Lango']
    );
    console.log('Success! Result:', res.rows);

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await client.end();
  }
}

run();
