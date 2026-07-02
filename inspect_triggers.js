const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // Query triggers on auth.users and profiles
    const res = await client.query(`
      SELECT 
        event_object_schema as schema,
        event_object_table as table,
        trigger_name,
        action_statement as definition,
        action_timing as timing,
        event_manipulation as event
      FROM information_schema.triggers
      WHERE event_object_table IN ('users', 'profiles') OR event_object_schema = 'auth'
      ORDER BY event_object_table, trigger_name;
    `);

    console.log('--- Triggers ---');
    res.rows.forEach(r => {
      console.log(`Table: ${r.schema}.${r.table} | Trigger: ${r.trigger_name} | Timing: ${r.timing} | Event: ${r.event}`);
      console.log(`Definition: ${r.definition}\n`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
