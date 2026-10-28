import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { CalendarGroup, CalendarLink } from '../../lib/types';
import { useUserId } from '../useAuth';
import { must, tempId, useListMutation } from './cache';

export const calendarsKey = (uid: string) => ['calendars', uid];
export const groupsKey = (uid: string) => ['calendar_groups', uid];

export function useCalendars() {
  const uid = useUserId();
  return useQuery({
    queryKey: calendarsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('calendars').select('*').order('sort')) as CalendarLink[],
  });
}

export function useCalendarGroups() {
  const uid = useUserId();
  return useQuery({
    queryKey: groupsKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('calendar_groups').select('*').order('sort')) as CalendarGroup[],
  });
}

export type CalendarDraft = Pick<CalendarLink, 'name' | 'url' | 'emoji' | 'color' | 'group_id' | 'sync'>;

export function useAddCalendar() {
  const uid = useUserId();
  return useListMutation<CalendarDraft, CalendarLink, CalendarLink>(
    calendarsKey(uid),
    async (c) => must(await supabase.from('calendars').insert(c).select('*').single()) as CalendarLink,
    (list, c) => [...list, { id: tempId(), pinned: false, sort: Date.now() / 1000, created_at: new Date().toISOString(), ...c }],
    'Could not save that calendar.',
  );
}

export function useUpdateCalendar() {
  const uid = useUserId();
  return useListMutation<{ id: string; patch: Partial<CalendarLink> }, CalendarLink>(
    calendarsKey(uid),
    async ({ id, patch }) => must(await supabase.from('calendars').update(patch).eq('id', id).select('id')),
    (list, { id, patch }) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)).sort((a, b) => a.sort - b.sort),
  );
}

export function useDeleteCalendar() {
  const uid = useUserId();
  return useListMutation<string, CalendarLink>(
    calendarsKey(uid),
    async (id) => must(await supabase.from('calendars').delete().eq('id', id).select('id')),
    (list, id) => list.filter((c) => c.id !== id),
  );
}

export function useRestoreCalendar() {
  const uid = useUserId();
  return useListMutation<CalendarLink, CalendarLink>(
    calendarsKey(uid),
    async (c) => must(await supabase.from('calendars').insert(c).select('id')),
    (list, c) => [...list, c].sort((a, b) => a.sort - b.sort),
  );
}

export function useSaveGroup() {
  const uid = useUserId();
  return useListMutation<{ id?: string; name: string; color: number }, CalendarGroup>(
    groupsKey(uid),
    async ({ id, ...g }) =>
      id ? must(await supabase.from('calendar_groups').update(g).eq('id', id).select('id')) : must(await supabase.from('calendar_groups').insert(g).select('id')),
    (list, { id, ...g }) => (id ? list.map((x) => (x.id === id ? { ...x, ...g } : x)) : [...list, { id: tempId(), sort: Date.now() / 1000, ...g }]),
  );
}

export function useDeleteGroup() {
  const uid = useUserId();
  return useListMutation<string, CalendarGroup>(
    groupsKey(uid),
    async (id) => must(await supabase.from('calendar_groups').delete().eq('id', id).select('id')),
    (list, id) => list.filter((g) => g.id !== id),
  );
}
