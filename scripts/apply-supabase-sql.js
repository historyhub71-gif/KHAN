/**
 * Applies supabase/RUN_ALL_SETUP.sql to your Supabase Postgres database.
 *
 * Usage:
 *   node scripts/apply-supabase-sql.js YOUR_DATABASE_PASSWORD
 *
 * Or set in .env:
 *   SUPABASE_DB_PASSWORD=your_password_from_supabase_dashboard
 *
 * Find password: Supabase Dashboard → Project Settings → Database → Database password
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PROJECT_REF = 'hevtjydsogadszcwdhhn';
const SQL_FILE = path.join(__dirname, '..', 'supabase', 'RUN_ALL_SETUP.sql');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnv();

  const password =
    process.argv[2] ||
    process.env.SUPABASE_DB_PASSWORD ||
    process.env.DATABASE_PASSWORD;

  if (!password) {
    console.error(`
Missing database password.

Option 1 — Run in terminal:
  node scripts/apply-supabase-sql.js YOUR_DATABASE_PASSWORD

Option 2 — Add to .env then run:
  SUPABASE_DB_PASSWORD=your_password
  node scripts/apply-supabase-sql.js

Get password from:
  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database
  → Database password → Reset or copy

Option 3 — Manual (no password needed):
  1. Open https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new
  2. Open file: supabase/RUN_ALL_SETUP.sql
  3. Copy all → Paste → Run
`);
    process.exit(1);
  }

  const connectionString =
    process.env.SUPABASE_DB_URL ||
    `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

  const sql = fs.readFileSync(SQL_FILE, 'utf8');

  console.log('Connecting to Supabase database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Running RUN_ALL_SETUP.sql ...');
    await client.query(sql);
    console.log('SUCCESS: All SQL applied (tables, RLS, notifications, triggers, realtime).');
    console.log('');
    console.log('Next: reload your Expo app and test teacher → mark absent → student dashboard.');
  } catch (err) {
    console.error('FAILED:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.error('Wrong database password. Reset it in Supabase Dashboard → Settings → Database.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
