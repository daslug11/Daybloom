import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let service: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Only for AI bookkeeping, admin and account deletion. */
export function serviceClient(): SupabaseClient {
  service ??= createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return service;
}

/** Client that acts as the signed-in user, so Row Level Security applies to every query. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
