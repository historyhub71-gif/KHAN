const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // Select some users from auth.users to see their email and encrypted_password
    const res = await client.query(`
      SELECT email, encrypted_password FROM auth.users LIMIT 10;
    `);

    res.rows.forEach(r => {
      console.log(`Email: ${r.email} | Hash: ${r.encrypted_password}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
