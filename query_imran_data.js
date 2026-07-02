const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    console.log('\n--- Profiles for Imran ---');
    const profileRes = await client.query(`
      SELECT * FROM public.profiles WHERE email = 'imran@gmail.com';
    `);
    console.log(profileRes.rows[0]);

    console.log('\n--- Student Profiles for Imran ---');
    const studentProfileRes = await client.query(`
      SELECT * FROM public.student_profiles WHERE id = $1;
    `, [profileRes.rows[0]?.id]);
    console.log(studentProfileRes.rows[0]);

    console.log('\n--- Student Enrollments for Imran ---');
    const enrollRes = await client.query(`
      SELECT * FROM public.student_enrollments WHERE student_id = $1;
    `, [profileRes.rows[0]?.id]);
    console.log(enrollRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
