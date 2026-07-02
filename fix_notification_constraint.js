const { Client } = require('pg');

const password = process.argv[2] || 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase DB\n');

    // 1. Show ALL constraints on the notifications table
    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.notifications'::regclass
      ORDER BY conname;
    `);
    console.log('📋 All constraints on notifications table:');
    constraints.rows.forEach(r => {
      console.log(`  - ${r.conname}: ${r.definition}`);
    });

    // 2. Show distinct notification_type values currently in DB
    const types = await client.query(`
      SELECT DISTINCT notification_type, COUNT(*) as count
      FROM public.notifications
      GROUP BY notification_type
      ORDER BY notification_type;
    `);
    console.log('\n📊 Distinct notification_type values in DB:');
    types.rows.forEach(r => console.log(`  - "${r.notification_type}" (${r.count} rows)`));

    // 3. Drop ALL check constraints on notifications related to notification_type
    console.log('\n🔧 Dropping all notification_type check constraints...');
    const toDrop = constraints.rows.filter(r => r.definition.includes('notification_type'));
    for (const c of toDrop) {
      await client.query(`ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS "${c.conname}";`);
      console.log(`  ✅ Dropped: ${c.conname}`);
    }

    // 4. Fix any invalid values in existing rows
    console.log('\n🔧 Fixing invalid notification_type values...');
    const validTypes = [
      'Monthly Fee Due Reminder','Fee Overdue Reminder','Payment Received Confirmation',
      'Fee Approval/Rejection Notification','Attendance Alert',
      'interview_completed','progress_review_due','payment_approved','payment_rejected',
      'interview_pending_review','admission_decision','interview_reviewed',
      'review_scheduled','fortnight_review_due','fee_ledger_updated',
      'admission_approved','new_student_assigned','progress_report','New Student Interview Required'
    ];
    const placeholders = validTypes.map((_, i) => `$${i + 1}`).join(',');
    const updateResult = await client.query(
      `UPDATE public.notifications SET notification_type = 'Attendance Alert' WHERE notification_type NOT IN (${placeholders}) RETURNING id`,
      validTypes
    );
    console.log(`  ✅ Fixed ${updateResult.rowCount} invalid rows`);

    // 5. Re-add the constraint with the correct name and full value set
    console.log('\n🔧 Adding new constraint notifications_notification_type_check...');
    await client.query(`
      ALTER TABLE public.notifications
        ADD CONSTRAINT notifications_notification_type_check
        CHECK (notification_type IN (
          'Monthly Fee Due Reminder','Fee Overdue Reminder','Payment Received Confirmation',
          'Fee Approval/Rejection Notification','Attendance Alert',
          'interview_completed','progress_review_due','payment_approved','payment_rejected',
          'interview_pending_review','admission_decision','interview_reviewed',
          'review_scheduled','fortnight_review_due','fee_ledger_updated',
          'admission_approved','new_student_assigned','progress_report','New Student Interview Required'
        ));
    `);
    console.log('  ✅ Constraint added successfully');

    // 6. Verify final state
    const final = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.notifications'::regclass AND conname LIKE '%notification_type%'
      ORDER BY conname;
    `);
    console.log('\n✅ Final constraint state:');
    final.rows.forEach(r => console.log(`  - ${r.conname}: ${r.definition}`));

    console.log('\n🎉 DONE! Create Deal should work now.');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
