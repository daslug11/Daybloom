import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { extractTags } from '../../lib/text';
import type { Note, NoteState } from '../../lib/types';
import { useUserId } from '../useAuth';
import { must, tempId, useListMutation } from './cache';

export const notesKey = (uid: string) => ['notes', uid];

/** All of the user's notes (the views — Inbox, Ideas, All, Archive — filter this list). */
export function useNotes() {
  const uid = useUserId();
  return useQuery({
    queryKey: notesKey(uid),
    enabled: !!uid,
    queryFn: async () =>
      must(await supabase.from('notes').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(2000)) as Note[],
  });
}

export function useAddNote() {
  const uid = useUserId();
  return useListMutation<{ body: string; state?: NoteState }, Note, Note>(
    notesKey(uid),
    async ({ body, state = 'inbox' }) => must(await supabase.from('notes').insert({ body: body.trim(), state, tags: extractTags(body) }).select('*').single()) as Note,
    (list, { body, state = 'inbox' }) => [
      { id: tempId(), body: body.trim(), state, pinned: false, tags: extractTags(body), processed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ...list,
    ],
    'Your note could not be saved. Please try again.',
  );
}

export function useUpdateNote() {
  const uid = useUserId();
  return useListMutation<{ id: string; patch: Partial<Note> }, Note>(
    notesKey(uid),
    async ({ id, patch }) => {
      const full = { ...patch };
      if (patch.body !== undefined) full.tags = extractTags(patch.body);
      if (patch.state && patch.state !== 'inbox' && full.processed_at === undefined) full.processed_at = new Date().toISOString();
      return must(await supabase.from('notes').update(full).eq('id', id).select('id'));
    },
    (list, { id, patch }) => list.map((n) => (n.id === id ? { ...n, ...patch, ...(patch.body !== undefined ? { tags: extractTags(patch.body) } : {}) } : n)),
  );
}

export function useDeleteNote() {
  const uid = useUserId();
  return useListMutation<string, Note>(
    notesKey(uid),
    async (id) => must(await supabase.from('notes').delete().eq('id', id).select('id')),
    (list, id) => list.filter((n) => n.id !== id),
  );
}
