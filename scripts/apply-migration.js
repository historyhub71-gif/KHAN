/**
 * Applies a specific SQL file to your Supabase Postgres database.
 *
 * Usage:
 *   node scripts/apply-migration.js YOUR_DATABASE_PASSWORD supabase/MASTER_SETUP.sql
 *
 * Or set SUPABASE_DB_PASSWORD in .env and run:
 *   node scripts/apply-migration.js supabase/MASTER_SETUP.sql
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PROJECT_REF = 'hevtjydsogadszcwdhhn';

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

  // Parse args: password is optional if set in .env
  let password, sqlFilePath;
  if (process.argv.length === 4) {
    password = process.argv[2];
    sqlFilePath = process.argv[3];
  } else if (process.argv.length === 3) {
    sqlFilePath = process.argv[2];
    password = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;
  } else {
    console.error('Usage: node scripts/apply-migration.js [DB_PASSWORD] <path/to/migration.sql>');
    process.exit(1);
  }

  if (!password) {
    console.error(`\nMissing database password.\nAdd SUPABASE_DB_PASSWORD to .env or pass it as first argument.\n`);
    process.exit(1);
  }

  const absolutePath = path.resolve(__dirname, '..', sqlFilePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

  console.log(`Connecting to Supabase...`);
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log(`Running: ${sqlFilePath} ...`);
    const result = await client.query(sql);
    const statusRow = Array.isArray(result) ? result.find(r => r.rows?.length > 0) : result;
    if (statusRow?.rows?.[0]) {
      console.log('Result:', statusRow.rows[0]);
    }
    console.log('\nSUCCESS: Migration applied.');
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
