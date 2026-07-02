/**
 * Verifies notifications table exists (uses anon key from .env).
 * Run: node scripts/verify-notifications-setup.js
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
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.from('notifications').select('id').limit(1);

  if (error) {
    console.error('NOT READY:', error.message);
    console.error('Run: node scripts/apply-supabase-sql.js YOUR_DB_PASSWORD');
    console.error('Or paste supabase/MASTER_SETUP.sql in Supabase SQL Editor.');
    process.exit(1);
  }

  console.log('OK: notifications table exists and is reachable.');
}

main();
