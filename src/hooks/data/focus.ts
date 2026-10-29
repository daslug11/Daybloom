import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { FocusSession } from '../../lib/types';
import { useUserId } from '../useAuth';
import { must, tempId, useListMutation } from './cache';

export const focusKey = (uid: string) => ['focus_sessions', uid];

/** Focus sessions from the last 35 days. */
export function useFocusSessions() {
  const uid = useUserId();
  return useQuery({
    queryKey: focusKey(uid),
    enabled: !!uid,
    queryFn: async () =>
      must(
        await supabase
          .from('focus_sessions')
          .select('id, task_id, started_at, minutes')
          .gte('started_at', new Date(Date.now() - 35 * 86_400_000).toISOString())
          .order('started_at'),
      ) as FocusSession[],
  });
}

export function useLogFocus() {
  const uid = useUserId();
  return useListMutation<Omit<FocusSession, 'id'>, FocusSession>(
    focusKey(uid),
    async (s) => must(await supabase.from('focus_sessions').insert(s).select('id')),
    (list, s) => [...list, { id: tempId(), ...s }],
    'Your focus session could not be logged.',
  );
}
