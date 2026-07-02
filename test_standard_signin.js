const { createClient } = require('@supabase/supabase-js');

const url = 'https://hevtjydsogadszcwdhhn.supabase.co';
const key = 'sb_publishable_uENAcIvAs1xj0bRsuuqkIw_DLWitRxf';
const supabase = createClient(url, key);

async function run() {
  const email = 'hasherkhano097@gmail.com';
  // Let's try signing in with a dummy password or correct password if we knew it.
  // Actually, we can check if it returns "Invalid login credentials" (which is a standard auth error)
  // or if it still returns "Database error querying schema".
  try {
    console.log(`Attempting sign-in for ${email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: 'SomeRandomPassword123!',
    });

    if (error) {
      console.error('Sign-in error:', error);
    } else {
      console.log('Sign-in successful:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
