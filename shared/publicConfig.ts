/**
 * Public Supabase settings for the live site (https://daybloom.online).
 *
 * These two values are designed to be public: the anon key only grants what
 * Row Level Security allows each signed-in user. They are the fallback when
 * SUPABASE_URL / SUPABASE_ANON_KEY aren't set at build or run time.
 *
 * Never put the service role key or the Anthropic API key here — those stay in
 * Vercel environment variables and are only read by the /api functions.
 */
export const PUBLIC_SUPABASE_URL = 'https://pxqbignoghmaelwifutl.supabase.co';
export const PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cWJpZ25vZ2htYWVsd2lmdXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjY5NzMsImV4cCI6MjEwODgwMjk3M30.6Vxad4Ltec7B-kLRWNg8O5l99DEp7g_v2ga3AJwaE7s';

/** The project URL without an API path: "https://x.supabase.co/rest/v1/" → "https://x.supabase.co". */
export function normalizeSupabaseUrl(url: string | undefined | null): string {
  return (url ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth|storage|realtime|functions)\/v1$/, '');
}

/** First non-empty value. Blank env vars count as missing. */
export const firstSet = (...values: (string | undefined | null)[]) => values.map((v) => v?.trim()).find((v) => !!v) ?? '';
