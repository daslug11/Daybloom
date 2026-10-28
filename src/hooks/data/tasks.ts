import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Task } from '../../lib/types';
import { useUserId } from '../useAuth';
import { useToast } from '../useToast';
import { must, tempId, useListMutation } from './cache';

export const tasksKey = (uid: string) => ['tasks', uid];

export type NewTask = Partial<Omit<Task, 'id' | 'created_at'>> & { title: string };

const blank = (t: NewTask): Task => ({
  id: tempId(),
  details: '',
  done: false,
  completed_at: null,
  priority: null,
  tags: [],
  due_date: null,
  due_time: null,
  estimate_min: null,
  top_date: null,
  sched_date: null,
  sched_start: null,
  sched_duration: null,
  goal_id: null,
  milestone_id: null,
  parent_id: null,
  source_note_id: null,
  sort: Date.now() / 1000,
  created_at: new Date().toISOString(),
  ...t,
});

/** Open tasks plus tasks completed in the last 60 days (enough for every view and the weekly review). */
export function useTasks() {
  const uid = useUserId();
  return useQuery({
    queryKey: tasksKey(uid),
    enabled: !!uid,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      return must(
        await supabase.from('tasks').select('*').or(`done.eq.false,completed_at.gte.${since}`).order('sort').limit(3000),
      ) as Task[];
    },
  });
}

export function useAddTasks() {
  const uid = useUserId();
  return useListMutation<NewTask[], Task, Task[]>(
    tasksKey(uid),
    async (tasks) => must(await supabase.from('tasks').insert(tasks).select('*')) as Task[],
    (list, tasks) => [...list, ...tasks.map(blank)],
    'Could not add that task. Please try again.',
  );
}

export function useUpdateTask() {
  const uid = useUserId();
  return useListMutation<{ id: string; patch: Partial<Task> }, Task>(
    tasksKey(uid),
    async ({ id, patch }) => must(await supabase.from('tasks').update(patch).eq('id', id).select('id')),
    (list, { id, patch }) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
}

export function useDeleteTask() {
  const uid = useUserId();
  return useListMutation<string, Task>(
    tasksKey(uid),
    async (id) => must(await supabase.from('tasks').delete().eq('id', id).select('id')),
    (list, id) => list.filter((t) => t.id !== id && t.parent_id !== id),
  );
}

/** Toggle done with an undo toast. */
export function useToggleTask() {
  const update = useUpdateTask();
  const toast = useToast();
  return (task: Task) => {
    const done = !task.done;
    update.mutate({ id: task.id, patch: { done, completed_at: done ? new Date().toISOString() : null } });
    if (done) {
      toast(`Completed “${task.title.length > 40 ? task.title.slice(0, 39) + '…' : task.title}”`, {
        label: 'Undo',
        onClick: () => update.mutate({ id: task.id, patch: { done: false, completed_at: null } }),
      });
    }
  };
}

export function useInvalidateTasks() {
  const qc = useQueryClient();
  const uid = useUserId();
  return () => qc.invalidateQueries({ queryKey: tasksKey(uid) });
}
