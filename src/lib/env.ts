import { normalizeSupabaseUrl, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '../../shared/publicConfig';

// Values injected at build time by vite.config.ts `define` (public, not secrets).
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
declare const __SITE_URL__: string;

export const SUPABASE_URL = normalizeSupabaseUrl(__SUPABASE_URL__ || PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = __SUPABASE_ANON_KEY__ || PUBLIC_SUPABASE_ANON_KEY;
/** Canonical site URL (SITE_URL env), used for auth email redirects. Falls back to the current origin. */
export const SITE_URL = (__SITE_URL__ || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
export const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
