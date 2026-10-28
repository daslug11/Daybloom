import { useQuery } from '@tanstack/react-query';
import { addDays } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import type { Habit, HabitLog } from '../../lib/types';
import { useUserId } from '../useAuth';
import { must, tempId, useListMutation } from './cache';

export const habitsKey = (uid: string) => ['habits', uid];
export const habitLogsKey = (uid: string) => ['habit_logs', uid];
/** History shown in grids: the last 12 weeks (+ a little for streaks). */
export const HISTORY_DAYS = 120;

export function useHabits() {
  const uid = useUserId();
  return useQuery({
    queryKey: habitsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('habits').select('*').is('archived_at', null).order('sort')) as Habit[],
  });
}

export function useHabitLogs(today: string) {
  const uid = useUserId();
  return useQuery({
    queryKey: habitLogsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('habit_logs').select('habit_id, day').gte('day', addDays(today, -HISTORY_DAYS))) as HabitLog[],
  });
}

export function useAddHabits() {
  const uid = useUserId();
  return useListMutation<{ name: string; emoji: string; goal_id?: string | null; source_note_id?: string | null }[], Habit, Habit[]>(
    habitsKey(uid),
    async (rows) => must(await supabase.from('habits').insert(rows).select('*')) as Habit[],
    (list, rows) => [
      ...list,
      ...rows.map((r) => ({ id: tempId(), goal_id: null, source_note_id: null, archived_at: null, sort: Date.now() / 1000, created_at: new Date().toISOString(), ...r })),
    ],
    'Could not add that habit.',
  );
}

export function useUpdateHabit() {
  const uid = useUserId();
  return useListMutation<{ id: string; patch: Partial<Habit> }, Habit>(
    habitsKey(uid),
    async ({ id, patch }) => must(await supabase.from('habits').update(patch).eq('id', id).select('id')),
    (list, { id, patch }) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)).filter((h) => !h.archived_at),
  );
}

export function useDeleteHabit() {
  const uid = useUserId();
  return useListMutation<string, Habit>(
    habitsKey(uid),
    async (id) => must(await supabase.from('habits').delete().eq('id', id).select('id')),
    (list, id) => list.filter((h) => h.id !== id),
  );
}

export function useToggleHabitLog() {
  const uid = useUserId();
  return useListMutation<{ habit_id: string; day: string; done: boolean }, HabitLog>(
    habitLogsKey(uid),
    async ({ habit_id, day, done }) =>
      done
        ? must(await supabase.from('habit_logs').upsert({ habit_id, day }, { onConflict: 'habit_id,day', ignoreDuplicates: true }).select('habit_id'))
        : must(await supabase.from('habit_logs').delete().eq('habit_id', habit_id).eq('day', day).select('habit_id')),
    (list, { habit_id, day, done }) => (done ? [...list.filter((l) => !(l.habit_id === habit_id && l.day === day)), { habit_id, day }] : list.filter((l) => !(l.habit_id === habit_id && l.day === day))),
  );
}
