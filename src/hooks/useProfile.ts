import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { browserTimeZone, dayIn, minutesIn } from '../lib/dates';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { useAuth } from './useAuth';
import { useNow } from './useNow';

const THEME_KEY = 'daybloom:theme';

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').single();
      if (error) throw error;
      return data as Profile;
    },
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id' | 'created_at'>>) => {
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', user!.id).select('*').single();
      if (error) throw error;
      return data as Profile;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['profile', user?.id] });
      const prev = qc.getQueryData<Profile>(['profile', user?.id]);
      if (prev) qc.setQueryData(['profile', user?.id], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(['profile', user?.id], ctx.prev),
    onSuccess: (data) => qc.setQueryData(['profile', user?.id], data),
  });
}

/** The user's time zone (profile, falling back to the browser's). */
export function useTimeZone() {
  const { data } = useProfile();
  return data?.timezone ?? browserTimeZone();
}

/** Today's date key and minutes-since-midnight in the user's zone; re-renders every `intervalMs`. */
export function useToday(intervalMs = 60_000) {
  const tz = useTimeZone();
  const now = useNow(intervalMs);
  return { today: dayIn(tz, now), minutes: minutesIn(tz, now), tz, now };
}

export function getStoredTheme(): 'dark' | 'light' {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  // The browser chrome (status bar, address bar) matches the canvas colour.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0b0c' : '#f3f3f4');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode */
  }
}

/** Keeps <html class="dark"> in sync with the profile (or the last theme used on this device). */
export function useThemeSync() {
  const { data } = useProfile();
  useEffect(() => {
    applyTheme(data?.theme ?? getStoredTheme());
  }, [data?.theme]);
}
