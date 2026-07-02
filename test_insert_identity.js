const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pgPassword = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(pgPassword)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

const url = 'https://hevtjydsogadszcwdhhn.supabase.co';
const key = 'sb_publishable_uENAcIvAs1xj0bRsuuqkIw_DLWitRxf';
const supabase = createClient(url, key);

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    const email = 'imran@gmail.com';
    const userId = '4c1d7377-73a7-428b-a48a-be20d41428ab';

    console.log('Inserting identity in auth.identities...');
    await client.query(`
      INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (
        $1,
        $2,
        jsonb_build_object('sub', $1::text, 'email', $3::text, 'email_verified', false, 'phone_verified', false),
        'email',
        now(),
        now(),
        now()
      )
      ON CONFLICT (provider_id, provider) DO NOTHING;
    `, [userId, userId, email]);

    console.log('Identity inserted successfully.');

    console.log('Attempting sign-in for imran@gmail.com...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: 'TestPassword123!',
    });

    if (signInError) {
      console.error('Sign-in error:', signInError);
    } else {
      console.log('Sign-in SUCCESSFUL! User ID:', signInData.user.id);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
