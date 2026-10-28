import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Goal, Milestone } from '../../lib/types';
import { useUserId } from '../useAuth';
import { must, tempId, useListMutation } from './cache';

export const goalsKey = (uid: string) => ['goals', uid];
export const milestonesKey = (uid: string) => ['milestones', uid];

export function useGoals() {
  const uid = useUserId();
  return useQuery({
    queryKey: goalsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('goals').select('*').order('sort')) as Goal[],
  });
}

export function useMilestones() {
  const uid = useUserId();
  return useQuery({
    queryKey: milestonesKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('milestones').select('*').order('sort')) as Milestone[],
  });
}

export type NewGoal = Pick<Goal, 'title' | 'emoji' | 'target' | 'current' | 'unit'> & Partial<Pick<Goal, 'due_date' | 'source_note_id'>>;

export function useAddGoal() {
  const uid = useUserId();
  return useListMutation<NewGoal, Goal, Goal>(
    goalsKey(uid),
    async (g) => must(await supabase.from('goals').insert(g).select('*').single()) as Goal,
    (list, g) => [...list, { id: tempId(), due_date: null, source_note_id: null, completed_at: null, sort: Date.now() / 1000, created_at: new Date().toISOString(), ...g }],
    'Could not add that goal.',
  );
}

export function useUpdateGoal() {
  const uid = useUserId();
  return useListMutation<{ id: string; patch: Partial<Goal> }, Goal>(
    goalsKey(uid),
    async ({ id, patch }) => must(await supabase.from('goals').update(patch).eq('id', id).select('id')),
    (list, { id, patch }) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  );
}

export function useDeleteGoal() {
  const uid = useUserId();
  return useListMutation<string, Goal>(
    goalsKey(uid),
    async (id) => must(await supabase.from('goals').delete().eq('id', id).select('id')),
    (list, id) => list.filter((g) => g.id !== id),
  );
}

export function useAddMilestones() {
  const uid = useUserId();
  return useListMutation<{ goal_id: string; title: string }[], Milestone, Milestone[]>(
    milestonesKey(uid),
    async (rows) => must(await supabase.from('milestones').insert(rows).select('*')) as Milestone[],
    (list, rows) => [...list, ...rows.map((r, i) => ({ id: tempId(), done: false, sort: Date.now() / 1000 + i, ...r }))],
  );
}

export function useUpdateMilestone() {
  const uid = useUserId();
  return useListMutation<{ id: string; patch: Partial<Milestone> }, Milestone>(
    milestonesKey(uid),
    async ({ id, patch }) => must(await supabase.from('milestones').update(patch).eq('id', id).select('id')),
    (list, { id, patch }) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  );
}

export function useDeleteMilestone() {
  const uid = useUserId();
  return useListMutation<string, Milestone>(
    milestonesKey(uid),
    async (id) => must(await supabase.from('milestones').delete().eq('id', id).select('id')),
    (list, id) => list.filter((m) => m.id !== id),
  );
}
