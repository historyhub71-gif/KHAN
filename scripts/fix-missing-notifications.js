/**
 * Backfill notifications for absent rows missing alerts (admin only).
 * Also tests teacher RPC if TEACHER_EMAIL and TEACHER_PASSWORD env/args set.
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
  const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_KEY
  );

  const email = process.argv[2] || 'hasherkhano097@gmail.com';
  const password = process.argv[3] || 'AdminPassword123!';

  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    process.exit(1);
  }

  const { data: absentRows, error: aErr } = await supabase
    .from('attendance')
    .select('id, student_id, teacher_id, course_id, date, status, courses(name)')
    .eq('status', 'absent');

  if (aErr) {
    console.error('Attendance error:', aErr.message);
    process.exit(1);
  }

  console.log('Absent records:', absentRows?.length ?? 0);

  let created = 0;
  for (const row of absentRows || []) {
    const courseName = row.courses?.name || 'your course';
    const message = `You were marked absent today in ${courseName}.`;

    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('attendance_id', row.id)
      .maybeSingle();

    if (existing) {
      console.log('Skip (exists):', row.id);
      continue;
    }

    const { error: insErr } = await supabase.from('notifications').insert({
      student_id: row.student_id,
      teacher_id: row.teacher_id,
      course_id: row.course_id,
      attendance_id: row.id,
      title: 'Attendance Alert',
      message,
      read: false,
    });

    if (insErr) {
      console.error('Insert failed for', row.id, insErr.message);
    } else {
      console.log('Created notification for student', row.student_id);
      created++;
    }
  }

  console.log('\nDone. Created', created, 'notification(s).');
}

main();
