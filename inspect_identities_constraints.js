const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    const res = await client.query(`
      SELECT 
        conname AS constraint_name, 
        contype AS constraint_type,
        pg_get_constraintdef(c.oid) AS constraint_definition
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'auth' AND c.conrelid = 'auth.identities'::regclass;
    `);

    console.log('--- auth.identities constraints ---');
    res.rows.forEach(r => {
      console.log(`Constraint: ${r.constraint_name} | Type: ${r.constraint_type}`);
      console.log(`Def: ${r.constraint_definition}\n`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
