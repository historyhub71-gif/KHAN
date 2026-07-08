const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to DB!');

    const directorId = '2c944c27-3323-4a4f-abaa-b61d8cdf8117';

    // 1. Test Director updating/soft deleting a fee payment
    console.log('\n--- Testing Director soft deleting a fee payment ---');
    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: directorId, role: 'authenticated' })]);
    await client.query('SET ROLE authenticated');
    
    // Check if is_director() is true
    const checkDirector = await client.query('SELECT public.is_director()');
    console.log('is_director() returns:', checkDirector.rows[0].is_director);

    // Get a sample fee payment ID
    const samplePayment = await client.query('SELECT id FROM public.fee_payments WHERE deleted_at IS NULL LIMIT 1');
    if (samplePayment.rows.length > 0) {
      const pid = samplePayment.rows[0].id;
      console.log('Sample payment ID:', pid);
      
      try {
        const updateRes = await client.query(
          `UPDATE public.fee_payments SET deleted_at = now(), deleted_by = $1 WHERE id = $2 RETURNING id`,
          [directorId, pid]
        );
        console.log('Update result row count:', updateRes.rowCount);
      } catch (e) {
        console.error('Update failed:', e.message);
      }
    } else {
      console.log('No active fee payments found.');
    }
    // Reset role before rollback
    await client.query('RESET ROLE');
    await client.query('ROLLBACK');

  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.end();
  }
}

run();
