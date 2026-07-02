const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    const res = await client.query(`
      SELECT * FROM auth.users WHERE email = $1;
    `, ['hasherkhano097@gmail.com']);

    console.log('User Record:', res.rows[0]);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
