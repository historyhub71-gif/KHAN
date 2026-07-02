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

    console.log('Aligning user fields for Imran...');
    await client.query(`
      UPDATE auth.users
      SET 
        is_super_admin = NULL,
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = ''
      WHERE email = 'imran@gmail.com';
    `);

    console.log('Fields aligned. Attempting sign-in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'imran@gmail.com',
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
