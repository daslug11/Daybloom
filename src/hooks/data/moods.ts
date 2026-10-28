import { useQuery } from '@tanstack/react-query';
import { addDays } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import type { Mood } from '../../lib/types';
import { useUserId } from '../useAuth';
import { must, useListMutation } from './cache';

export const moodsKey = (uid: string) => ['moods', uid];

/** The last ~5 weeks of check-ins. */
export function useMoods(today: string) {
  const uid = useUserId();
  return useQuery({
    queryKey: moodsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('moods').select('day, score, note').gte('day', addDays(today, -35)).order('day')) as Mood[],
  });
}

export function useSetMood() {
  const uid = useUserId();
  return useListMutation<Mood, Mood>(
    moodsKey(uid),
    async (m) => must(await supabase.from('moods').upsert(m, { onConflict: 'user_id,day' }).select('day')),
    (list, m) => [...list.filter((x) => x.day !== m.day), m].sort((a, b) => a.day.localeCompare(b.day)),
    'Your check-in could not be saved.',
  );
}
