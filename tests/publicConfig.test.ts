import { describe, expect, it } from 'vitest';
import { firstSet, normalizeSupabaseUrl, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '../shared/publicConfig';

describe('public Supabase config', () => {
  it('strips API paths and trailing slashes from the project URL', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co');
    expect(normalizeSupabaseUrl(' https://abc.supabase.co/auth/v1 ')).toBe('https://abc.supabase.co');
    expect(normalizeSupabaseUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co');
    expect(normalizeSupabaseUrl('http://localhost:54321')).toBe('http://localhost:54321');
    expect(PUBLIC_SUPABASE_URL).toBe(normalizeSupabaseUrl(PUBLIC_SUPABASE_URL));
  });

  it('prefers env values and treats blank ones as missing', () => {
    expect(firstSet(undefined, '  ', 'fallback')).toBe('fallback');
    expect(firstSet('from-env', 'fallback')).toBe('from-env');
  });

  it('only ever holds the public anon key', () => {
    const payload = JSON.parse(Buffer.from(PUBLIC_SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString());
    expect(payload.role).toBe('anon');
  });
});
