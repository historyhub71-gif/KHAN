const { Client } = require('pg');

const password = 'ag0bFxd1NY6laSOI';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.hevtjydsogadszcwdhhn.supabase.co:5432/postgres`;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase DB\n');

    // 1. Show ALL constraints on the interviews table
    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.interviews'::regclass
      ORDER BY conname;
    `);
    console.log('📋 All constraints on interviews table:');
    constraints.rows.forEach(r => {
      console.log(`  - ${r.conname}: ${r.definition}`);
    });

    // 2. Drop the old constraint
    console.log('\n🔧 Dropping interviews_assigned_level_check constraint...');
    await client.query(`
      ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS interviews_assigned_level_check;
    `);
    console.log('  ✅ Constraint dropped');

    // 3. Add the updated check constraint
    console.log('\n🔧 Adding updated interviews_assigned_level_check constraint...');
    await client.query(`
      ALTER TABLE public.interviews
        ADD CONSTRAINT interviews_assigned_level_check
        CHECK (assigned_level IN ('Beginner', 'Elementary', 'Intermediate', 'Advanced'));
    `);
    console.log('  ✅ Constraint updated successfully');

    // 4. Verify final state
    const final = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.interviews'::regclass AND conname = 'interviews_assigned_level_check'
      ORDER BY conname;
    `);
    console.log('\n📋 Final constraint state:');
    final.rows.forEach(r => {
      console.log(`  - ${r.conname}: ${r.definition}`);
    });

    console.log('\n🎉 DONE! Interview submission should work now.');

  } catch (err) {
    console.error('❌ Error executing fix:', err);
  } finally {
    await client.end();
  }
}

run();
