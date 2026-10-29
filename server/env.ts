import { firstSet, normalizeSupabaseUrl, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '../shared/publicConfig.js';

/**
 * Server configuration from environment variables (Vercel → Settings → Environment Variables).
 * Every value is read lazily so tests can set process.env before the first request.
 */
function num(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  /** Public values: env vars win, else the committed public config (shared/publicConfig.ts). */
  get supabaseUrl() {
    return normalizeSupabaseUrl(firstSet(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL, PUBLIC_SUPABASE_URL));
  },
  get supabaseAnonKey() {
    return firstSet(process.env.SUPABASE_ANON_KEY, process.env.VITE_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_ANON_KEY);
  },
  /** Secret: only ever from the environment. */
  get supabaseServiceKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get siteUrl() {
    return (process.env.SITE_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '');
  },
  get anthropicKeyPresent() {
    return !!process.env.ANTHROPIC_API_KEY?.trim();
  },
  /** AI requests per user per UTC day (admins can override per user). */
  get dailyAiLimit() {
    return Math.floor(num('DAILY_AI_LIMIT_PER_USER') ?? 15);
  },
  /** Global spend caps in USD. Unset falls back to a small safe default, never to "no cap". */
  get dailySpendCap() {
    return num('DAILY_SPEND_CAP_USD') ?? 0.5;
  },
  get monthlySpendCap() {
    return num('MONTHLY_SPEND_CAP_USD') ?? 5;
  },
  /** Optional comma-separated allow-list of emails that may use AI. */
  get allowedEmails(): string[] | null {
    const raw = process.env.ALLOWED_EMAILS?.trim();
    if (!raw) return null;
    return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  },
  get adminEmail() {
    return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
  },
};
