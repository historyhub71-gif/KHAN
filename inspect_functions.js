const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    const res1 = await client.query(`
      SELECT pg_get_functiondef('public.validate_student_signup_eligibility(text)'::regprocedure) AS def;
    `);
    console.log('--- validate_student_signup_eligibility definition ---');
    console.log(res1.rows[0].def);

    const res2 = await client.query(`
      SELECT pg_get_functiondef('public.complete_approved_student_signup(text,text,text)'::regprocedure) AS def;
    `);
    console.log('--- complete_approved_student_signup definition ---');
    console.log(res2.rows[0].def);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
