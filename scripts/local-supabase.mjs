// Manage the local Supabase stack used for development and e2e tests.
//   node scripts/local-supabase.mjs up       start containers, apply migrations, write .env.local
//   node scripts/local-supabase.mjs migrate  re-apply supabase/migrations/*.sql
//   node scripts/local-supabase.mjs reset    destroy containers + data, then up
//   node scripts/local-supabase.mjs down     stop containers
import { execSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const localDir = path.join(root, 'supabase', 'local');
const stackEnvFile = path.join(localDir, '.env');
const appEnvFile = path.join(root, '.env.local');

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}
function signJwt(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function loadStackEnv() {
  if (existsSync(stackEnvFile)) {
    return Object.fromEntries(
      readFileSync(stackEnvFile, 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
    );
  }
  const env = {
    POSTGRES_PASSWORD: randomBytes(16).toString('hex'),
    JWT_SECRET: randomBytes(32).toString('hex'),
    SITE_URL: process.env.SITE_URL ?? 'http://localhost:5173',
  };
  writeFileSync(stackEnvFile, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  return env;
}

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: localDir, ...opts });
const compose = (args) => sh(`docker compose --env-file .env ${args}`);

function psql(env, sqlFile) {
  execSync(`psql "postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -q -f "${sqlFile}"`, {
    stdio: 'inherit',
  });
}

async function waitFor(url, label) {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not become ready`);
}

const dbUrl = (env) => `postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:54322/postgres`;
const query = (env, sql) => execSync(`psql "${dbUrl(env)}" -v ON_ERROR_STOP=1 -qAt -c "${sql}"`, { encoding: 'utf8' }).trim();

/** Applies each migration once; applied file names are recorded in local_meta.migrations. */
function migrate(env) {
  query(env, 'create schema if not exists local_meta; create table if not exists local_meta.migrations (name text primary key, applied_at timestamptz not null default now())');
  const applied = new Set(query(env, 'select name from local_meta.migrations').split('\n').filter(Boolean));
  const dir = path.join(root, 'supabase', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    console.log(`[migrate] ${file}`);
    psql(env, path.join(dir, file));
    query(env, `insert into local_meta.migrations (name) values ('${file}')`);
  }
}

function writeAppEnv(env) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 10 * 365 * 24 * 3600;
  const anon = signJwt({ iss: 'supabase-local', role: 'anon', iat: now, exp }, env.JWT_SECRET);
  const service = signJwt({ iss: 'supabase-local', role: 'service_role', iat: now, exp }, env.JWT_SECRET);
  const existing = existsSync(appEnvFile) ? readFileSync(appEnvFile, 'utf8') : '';
  const keep = existing.split('\n').filter((l) => l && !/^(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SITE_URL)=/.test(l));
  const lines = [
    '# Written by scripts/local-supabase.mjs for the LOCAL stack. Never commit real keys.',
    'SUPABASE_URL=http://localhost:54321',
    `SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    `SITE_URL=${env.SITE_URL}`,
    ...keep.filter((l) => !l.startsWith('# Written by')),
  ];
  writeFileSync(appEnvFile, lines.join('\n') + '\n');
  console.log(`[env] wrote ${path.relative(root, appEnvFile)}`);
}

const cmd = process.argv[2] ?? 'up';
const env = loadStackEnv();
if (cmd === 'down') compose('down');
else if (cmd === 'migrate') migrate(env);
else if (cmd === 'up' || cmd === 'reset') {
  if (cmd === 'reset') compose('down -v');
  compose('up -d');
  await waitFor('http://127.0.0.1:54331/health', 'GoTrue');
  await waitFor('http://127.0.0.1:54332/', 'PostgREST');
  migrate(env);
  // PostgREST caches the schema; tell it to reload after migrations.
  execSync(`psql "postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:54322/postgres" -q -c "NOTIFY pgrst, 'reload schema'"`);
  writeAppEnv(env);
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}
