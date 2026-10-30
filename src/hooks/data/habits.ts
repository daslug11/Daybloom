import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, streak } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import type { Habit, HabitLog } from '../../lib/types';
import { useUserId } from '../useAuth';
import { useToast } from '../useToast';
import { must, tempId, useListMutation } from './cache';

export const habitsKey = (uid: string) => ['habits', uid];
/** Under habitsKey, so anything that invalidates habits refreshes the archived list too. */
export const archivedHabitsKey = (uid: string) => ['habits', uid, 'archived'];
/** Keyed by day too, so the window moves at midnight. `['habit_logs', uid]` still matches every day for invalidation. */
export const habitLogsKey = (uid: string, today?: string) => (today ? ['habit_logs', uid, today] : ['habit_logs', uid]);
/** History shown in grids: the last 12 weeks (+ a little for streaks). */
export const HISTORY_DAYS = 120;
/** Older history is fetched in chunks of this many days, only for habits whose streak reaches the edge. */
const CHUNK_DAYS = 365;
const MAX_CHUNKS = 10;
/** Streaks are counted back at most this far; a streak that reaches it is shown as "N+". */
export const STREAK_LIMIT_DAYS = HISTORY_DAYS + CHUNK_DAYS * MAX_CHUNKS;

/** First day of the current streak, or null when there is none. */
export function streakStart(days: Set<string>, today: string) {
  const n = streak(days, today);
  if (!n) return null;
  return addDays(days.has(today) ? today : addDays(today, -1), -(n - 1));
}

/** True when the streak runs all the way back to the fetch limit, so the real number may be higher. */
export function streakIsCapped(days: Set<string>, today: string) {
  const start = streakStart(days, today);
  return !!start && start <= addDays(today, -STREAK_LIMIT_DAYS);
}

/**
 * The last HISTORY_DAYS of logs, plus — for any habit whose current streak reaches back to the
 * edge of what was fetched — older logs, a year at a time, until the streak has a gap.
 * So streaks aren't silently capped at ~120 days.
 */
async function fetchHabitLogs(today: string) {
  let edge = addDays(today, -HISTORY_DAYS);
  const logs = must(await supabase.from('habit_logs').select('habit_id, day').gte('day', edge)) as HabitLog[];
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const byHabit = new Map<string, Set<string>>();
    for (const l of logs) {
      if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Set());
      byHabit.get(l.habit_id)!.add(l.day);
    }
    const reaching = [...byHabit.entries()].filter(([, days]) => {
      const start = streakStart(days, today);
      return !!start && start <= edge;
    }).map(([id]) => id);
    if (!reaching.length) break;
    const from = addDays(edge, -CHUNK_DAYS);
    const older = must(await supabase.from('habit_logs').select('habit_id, day').in('habit_id', reaching).gte('day', from).lt('day', edge)) as HabitLog[];
    logs.push(...older);
    edge = from;
  }
  return logs;
}

export function useHabits() {
  const uid = useUserId();
  return useQuery({
    queryKey: habitsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('habits').select('*').is('archived_at', null).order('sort')) as Habit[],
  });
}

/** Archived habits, most recently archived first. Their logs are kept. */
export function useArchivedHabits() {
  const uid = useUserId();
  return useQuery({
    queryKey: archivedHabitsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('habits').select('*').not('archived_at', 'is', null).order('archived_at', { ascending: false })) as Habit[],
  });
}

/** Brings an archived habit back to the list, history and all. Optimistic in both lists. */
export function useRestoreHabit() {
  const uid = useUserId();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (h: Habit) => must(await supabase.from('habits').update({ archived_at: null }).eq('id', h.id).select('id')),
    onMutate: async (h) => {
      await qc.cancelQueries({ queryKey: habitsKey(uid) });
      const prevActive = qc.getQueryData<Habit[]>(habitsKey(uid));
      const prevArchived = qc.getQueryData<Habit[]>(archivedHabitsKey(uid));
      qc.setQueryData<Habit[]>(archivedHabitsKey(uid), (list) => list?.filter((x) => x.id !== h.id));
      qc.setQueryData<Habit[]>(habitsKey(uid), (list) => (list ? [...list.filter((x) => x.id !== h.id), { ...h, archived_at: null }].sort((a, b) => a.sort - b.sort) : list));
      return { prevActive, prevArchived };
    },
    onError: (err, _h, ctx) => {
      if (ctx?.prevActive) qc.setQueryData(habitsKey(uid), ctx.prevActive);
      if (ctx?.prevArchived) qc.setQueryData(archivedHabitsKey(uid), ctx.prevArchived);
      console.error(err);
      toast('Could not restore that habit. Please try again.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: habitsKey(uid) }),
  });
}

export function useHabitLogs(today: string) {
  const uid = useUserId();
  return useQuery({
    queryKey: habitLogsKey(uid, today),
    enabled: !!uid,
    queryFn: () => fetchHabitLogs(today),
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

/** Tick or untick a day. Optimistic across every cached day-window of logs; rolls back on failure. */
export function useToggleHabitLog() {
  const uid = useUserId();
  const qc = useQueryClient();
  const toast = useToast();
  const key = habitLogsKey(uid);
  const apply = (list: HabitLog[], { habit_id, day, done }: { habit_id: string; day: string; done: boolean }) => {
    const rest = list.filter((l) => !(l.habit_id === habit_id && l.day === day));
    return done ? [...rest, { habit_id, day }] : rest;
  };
  return useMutation({
    mutationFn: async ({ habit_id, day, done }: { habit_id: string; day: string; done: boolean }) =>
      done
        ? must(await supabase.from('habit_logs').upsert({ habit_id, day }, { onConflict: 'habit_id,day', ignoreDuplicates: true }).select('habit_id'))
        : must(await supabase.from('habit_logs').delete().eq('habit_id', habit_id).eq('day', day).select('habit_id')),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueriesData<HabitLog[]>({ queryKey: key });
      qc.setQueriesData<HabitLog[]>({ queryKey: key }, (list) => (list ? apply(list, vars) : list));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      for (const [k, data] of ctx?.prev ?? []) qc.setQueryData(k, data);
      console.error(err);
      toast('That change could not be saved. Please try again.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
