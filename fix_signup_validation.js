const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase DB\n');

    // Deploy the fixed validate_student_signup_eligibility function
    await client.query(`
DROP FUNCTION IF EXISTS public.validate_student_signup_eligibility(text) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_student_signup_eligibility(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email  text := lower(trim(p_email));
  v_deal   RECORD;
BEGIN
  -- 1. Find the most recent admission deal for this email
  SELECT * INTO v_deal FROM public.admission_deals
  WHERE lower(student_email) = v_email ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'admission_deal_not_found');
  END IF;

  -- 2. Primary gate: the deal must be approved and cleared for signup.
  --    This is the authoritative check — if admin approved the workflow, both
  --    admission_status='approved' and student_account_status='approved_for_signup'
  --    are set atomically by approve_student_admission_workflow().
  IF v_deal.admission_status = 'approved'
     AND v_deal.student_account_status IN ('approved_for_signup', 'approved') THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'deal_id', v_deal.id,
      'interview_id', v_deal.interview_id,
      'admission_status', v_deal.admission_status
    );
  END IF;

  -- 3. Not eligible — return a helpful reason
  RETURN jsonb_build_object(
    'eligible', false,
    'reason', CASE
      WHEN v_deal.admission_status NOT IN ('approved') THEN 'interview_or_admin_approval_pending'
      ELSE 'admission_not_approved_for_signup'
    END,
    'deal_id', v_deal.id,
    'admission_status', v_deal.admission_status,
    'student_account_status', v_deal.student_account_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_student_signup_eligibility(text) TO anon, authenticated;
    `);
    console.log('✅ Function deployed successfully\n');

    // Test against all deals again
    const deals = await client.query(`
      SELECT student_name, student_email, admission_status, student_account_status
      FROM public.admission_deals
      ORDER BY created_at DESC LIMIT 10;
    `);

    console.log('📋 Testing validate_student_signup_eligibility for each deal email:');
    for (const deal of deals.rows) {
      const res = await client.query(
        `SELECT public.validate_student_signup_eligibility($1) AS result`,
        [deal.student_email]
      );
      const result = res.rows[0].result;
      const eligible = result.eligible;
      console.log(`  ${eligible ? '✅' : '❌'} ${deal.student_name} (${deal.student_email}): admission=${deal.admission_status} account=${deal.student_account_status} → eligible=${eligible}${!eligible ? ' reason='+result.reason : ''}`);
    }

    console.log('\n🎉 DONE! Student signup should now work for approved deals.');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

run();
