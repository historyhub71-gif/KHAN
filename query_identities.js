const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    console.log('--- Identities for hasherkhano097@gmail.com ---');
    const res1 = await client.query(`
      SELECT * FROM auth.identities WHERE user_id = 'fae1e717-4297-481d-8f33-2cb821b892b6';
    `);
    console.log(res1.rows);

    console.log('--- Identities for imran@gmail.com ---');
    const res2 = await client.query(`
      SELECT * FROM auth.identities WHERE user_id = '4c1d7377-73a7-428b-a48a-be20d41428ab';
    `);
    console.log(res2.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
