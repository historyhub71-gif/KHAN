const { createClient } = require('@supabase/supabase-js');

const url = 'https://hevtjydsogadszcwdhhn.supabase.co';
const key = 'sb_publishable_uENAcIvAs1xj0bRsuuqkIw_DLWitRxf';
const supabase = createClient(url, key);

async function run() {
  const email = 'haso@gmail.com';
  const password = 'TestPassword123!';
  const name = 'Haso';

  try {
    console.log(`Step 1: Validating eligibility for ${email}...`);
    const { data: eligibleData, error: eligibleError } = await supabase.rpc('validate_student_signup_eligibility', {
      p_email: email,
    });

    if (eligibleError) {
      console.error('Validation RPC error:', eligibleError);
      return;
    }
    console.log('Validation RPC result:', eligibleData);

    if (!eligibleData.eligible) {
      console.log('Not eligible. Reason:', eligibleData.reason);
      return;
    }

    console.log('\nStep 2: Calling complete_approved_student_signup...');
    const { error: signUpError } = await supabase.rpc('complete_approved_student_signup', {
      p_email: email,
      p_password: password,
      p_name: name,
    });

    if (signUpError) {
      console.error('Signup RPC error:', signUpError);
      return;
    }
    console.log('Signup RPC completed successfully.');

    console.log('\nStep 3: Attempting sign-in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (signInError) {
      console.error('Sign-in error:', signInError);
      return;
    }
    console.log('Sign-in SUCCESSFUL! User ID:', signInData.user.id);

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
