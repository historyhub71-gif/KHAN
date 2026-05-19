const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    console.log('Loading .env from:', envPath);
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      const val = t.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } else {
    console.log('.env file not found at:', envPath);
  }
}

async function main() {
  loadEnv();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hevtjydsogadszcwdhhn.supabase.co';
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_uENAcIvAs1xj0bRsuuqkIw_DLWitRxf';

  const supabase = createClient(url, key);

  const email = 'hasherkhano097@gmail.com';
  const password = 'AdminPassword123!';
  console.log('Signing in as', email, '...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    process.exit(1);
  }
  console.log('Auth successful. User ID:', auth.user.id);

  console.log('\n--- Profiles ---');
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log(profiles);

  console.log('\n--- Courses ---');
  const { data: courses } = await supabase.from('courses').select('*');
  console.log(courses);

  console.log('\n--- Course Teachers ---');
  const { data: courseTeachers } = await supabase.from('course_teachers').select('*');
  console.log(courseTeachers);

  console.log('\n--- Course Students ---');
  const { data: courseStudents } = await supabase.from('course_students').select('*');
  console.log(courseStudents);

  console.log('\n--- Attendance ---');
  const { data: attendance } = await supabase.from('attendance').select('*');
  console.log(attendance);

  console.log('\n--- Mismatched / Orphaned Attendance Check ---');
  if (attendance && courses) {
    const courseIds = new Set(courses.map(c => c.id));
    const studentEnrolled = new Map(); // courseId -> Set(studentId)
    if (courseStudents) {
      for (const cs of courseStudents) {
        if (!studentEnrolled.has(cs.course_id)) {
          studentEnrolled.set(cs.course_id, new Set());
        }
        studentEnrolled.get(cs.course_id).add(cs.student_id);
      }
    }

    for (const record of attendance) {
      if (!courseIds.has(record.course_id)) {
        console.log(`Orphaned attendance record: Course ID ${record.course_id} in attendance does not exist in courses table!`);
      } else {
        const enrolled = studentEnrolled.get(record.course_id);
        if (!enrolled || !enrolled.has(record.student_id)) {
          console.log(`Attendance record exists for student ${record.student_id} in course ${record.course_id}, but student is NOT enrolled in course_students!`);
        }
      }
    }
  }
}

main().catch(console.error);
