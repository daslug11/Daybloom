import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

/** Reads .env.local written by `npm run supabase:up` (local stack only). */
export function localEnv(): Record<string, string> | null {
  if (!existsSync('.env.local')) return null;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split(/=(.*)/s).slice(0, 2) as [string, string]),
  );
  return env.SUPABASE_URL?.includes('localhost') ? env : null;
}

export const env = localEnv();
export const hasStack = !!env;

export function anonClient(): SupabaseClient {
  return createClient(env!.SUPABASE_URL, env!.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function serviceClient(): SupabaseClient {
  return createClient(env!.SUPABASE_URL, env!.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Creates a confirmed user via the admin API and returns a signed-in client. */
export async function newUser(name = 'Tester') {
  const email = `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
  const password = 'correct-horse-9';
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error) throw error;
  const client = anonClient();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { client, id: data.user.id, email, password };
}

/** Latest email to an address from the local Mailpit inbox. */
export async function latestEmail(to: string, subjectIncludes?: string) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`http://localhost:54324/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const list = (await res.json()) as { messages?: { ID: string; Subject: string }[] };
    const hit = list.messages?.find((m) => !subjectIncludes || m.Subject.includes(subjectIncludes));
    if (hit) {
      const msg = await (await fetch(`http://localhost:54324/api/v1/message/${hit.ID}`)).json();
      return msg as { Subject: string; HTML: string; Text: string };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email to ${to}`);
}

export function linkFrom(html: string) {
  const m = html.match(/href="([^"]*\/verify[^"]*)"/);
  if (!m) throw new Error('no verify link in email');
  return m[1].replace(/&amp;/g, '&');
}
