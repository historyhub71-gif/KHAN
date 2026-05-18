/**
 * Debug: sign in as admin and list all notifications + recent attendance
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  const supabase = createClient(url, key);

  const email = process.argv[2] || 'hasherkhano097@gmail.com';
  const password = process.argv[3] || 'AdminPassword123!';

  console.log('Signing in as', email, '...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    process.exit(1);
  }
  console.log('User id:', auth.user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, approved')
    .eq('id', auth.user.id)
    .single();
  console.log('Profile:', profile);

  const { data: notifs, error: nErr } = await supabase
    .from('notifications')
    .select('id, student_id, message, created_at, read')
    .order('created_at', { ascending: false })
    .limit(10);

  if (nErr) {
    console.error('Notifications query error:', nErr.message);
  } else {
    console.log('\nNotifications in DB (last 10):', notifs?.length ?? 0);
    notifs?.forEach((n) => console.log(' -', n.message, '| student:', n.student_id));
  }

  const { data: absentToday, error: aErr } = await supabase
    .from('attendance')
    .select('id, student_id, course_id, status, date')
    .eq('status', 'absent')
    .order('created_at', { ascending: false })
    .limit(5);

  if (aErr) {
    console.error('Attendance query error:', aErr.message);
  } else {
    console.log('\nRecent absent attendance:', absentToday?.length ?? 0);
    absentToday?.forEach((a) => console.log(' -', a.date, a.student_id, a.id));
  }

  // Test as student if second account provided
  const studentEmail = process.argv[4];
  if (studentEmail) {
    const studentPass = process.argv[5] || password;
    await supabase.auth.signOut();
    const { data: sAuth, error: sErr } = await supabase.auth.signInWithPassword({
      email: studentEmail,
      password: studentPass,
    });
    if (sErr) {
      console.error('Student auth failed:', sErr.message);
      return;
    }
    const { data: mine, error: mErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('student_id', sAuth.user.id);
    console.log('\nStudent sees notifications:', mErr?.message || mine?.length);
    mine?.forEach((n) => console.log(' -', n.message));
  }
}

main();
