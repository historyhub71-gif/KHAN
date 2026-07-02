const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase DB\n');

    // Run the validate function and inspect its return value for a deal email
    // First, let's show what admission_deals exist and their current statuses
    const deals = await client.query(`
      SELECT id, student_name, student_email, admission_status, student_account_status, interview_id, student_id
      FROM public.admission_deals
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    console.log('📋 Latest Admission Deals:');
    deals.rows.forEach(r => {
      console.log(`  - ${r.student_name} | ${r.student_email} | admission=${r.admission_status} | account=${r.student_account_status} | interview_id=${r.interview_id} | student_id=${r.student_id}`);
    });

    // Also check interviews status for those emails
    if (deals.rows.length > 0) {
      const emails = deals.rows.map(r => r.student_email.toLowerCase());
      const interviews = await client.query(`
        SELECT i.id, i.student_id, i.interview_type, i.status, i.student_email, p.email as profile_email
        FROM public.interviews i
        LEFT JOIN public.profiles p ON p.id = i.student_id
        WHERE i.interview_type = 'admission' AND i.deleted_at IS NULL
        ORDER BY i.created_at DESC
        LIMIT 20;
      `);
      console.log('\n📋 Admission Interviews:');
      interviews.rows.forEach(r => {
        console.log(`  - Interview ${r.id} | student_id=${r.student_id} | status=${r.status} | interview_email=${r.student_email} | profile_email=${r.profile_email}`);
      });
    }

    // Test the validate function directly
    console.log('\n📋 Testing validate_student_signup_eligibility for each deal email:');
    for (const deal of deals.rows) {
      const res = await client.query(`SELECT public.validate_student_signup_eligibility($1) AS result`, [deal.student_email]);
      console.log(`  - ${deal.student_email}: ${JSON.stringify(res.rows[0].result)}`);
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

run();
