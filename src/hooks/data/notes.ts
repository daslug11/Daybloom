import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../../lib/supabase';
import { extractTags } from '../../lib/text';
import type { Note, NoteState } from '../../lib/types';
import { useUserId } from '../useAuth';
import { useToast } from '../useToast';
import { must, tempId, useListMutation } from './cache';

export const notesKey = (uid: string) => ['notes', uid];

/** All of the user's notes (the views — Inbox, Ideas, All, Archive — filter this list). Notes waiting in the trash are left out. */
export function useNotes() {
  const uid = useUserId();
  const qc = useQueryClient();
  const version = useSyncExternalStore(subscribeTrash, trashVersion);
  // A delete left pending by a closed or reloaded tab is finished now.
  useEffect(() => {
    if (uid) resumeTrash(uid, qc);
  }, [uid, qc]);
  const select = useCallback(
    (list: Note[]) => {
      const hidden = hiddenIds(uid);
      return hidden.size ? list.filter((n) => !hidden.has(n.id)) : list;
    },
    // `version` changes whenever a note goes into or out of the trash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, version],
  );
  return useQuery({
    queryKey: notesKey(uid),
    enabled: !!uid,
    queryFn: async () =>
      must(await supabase.from('notes').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(2000)) as Note[],
    select,
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

/*
 * Soft delete. A deleted note is hidden at once but only removed from the database once its
 * Undo window has passed, so Undo gives back the very same note: id, capture date, pin, tags,
 * and the tasks, habits and goals that link back to it (their source_note_id is ON DELETE SET
 * NULL, so a real delete would cut those links). Pending ids are also kept in localStorage: a
 * delete left pending by a closed or reloaded tab is finished on the next load. If Undo comes
 * after the delete went through (the toast was paused, say), the note is re-inserted with its
 * original id and fields and its links are put back.
 */
/** How long a deleted note waits before it's really deleted: the Undo toast's 8s plus a margin. */
export const NOTE_TRASH_MS = 10_000;

type Links = { tasks: string[]; habits: string[]; goals: string[] };
interface TrashEntry {
  uid: string;
  note?: Note;
  state: 'pending' | 'committing' | 'committed';
  timer?: number;
  links?: Links;
  done?: Promise<void>;
}
const trash = new Map<string, TrashEntry>();
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
function subscribeTrash(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const trashVersion = () => version;

const storeKey = (uid: string) => `daybloom:note-trash:${uid}`;
function readStored(uid: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(storeKey(uid)) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}
function writeStored(uid: string, edit: (m: Record<string, number>) => void) {
  try {
    const m = readStored(uid);
    edit(m);
    if (Object.keys(m).length) localStorage.setItem(storeKey(uid), JSON.stringify(m));
    else localStorage.removeItem(storeKey(uid));
  } catch {
    /* storage unavailable: the in-tab timer still finishes the delete */
  }
}

function hiddenIds(uid: string) {
  const ids = new Set<string>(Object.keys(readStored(uid)));
  for (const [id, t] of trash) if (t.uid === uid) ids.add(id);
  return ids;
}

const refresh = (qc: QueryClient, uid: string, all = false) => {
  qc.invalidateQueries({ queryKey: notesKey(uid) });
  if (all) for (const k of ['tasks', 'habits', 'goals']) qc.invalidateQueries({ queryKey: [k, uid] });
};

async function linksOf(id: string): Promise<Links> {
  const ids = async (table: 'tasks' | 'habits' | 'goals') =>
    (must(await supabase.from(table).select('id').eq('source_note_id', id)) as { id: string }[]).map((r) => r.id);
  const [tasks, habits, goals] = await Promise.all([ids('tasks'), ids('habits'), ids('goals')]);
  return { tasks, habits, goals };
}

function commit(id: string, qc: QueryClient, onError?: () => void) {
  const t = trash.get(id);
  if (!t || t.state !== 'pending') return t?.done;
  window.clearTimeout(t.timer);
  t.state = 'committing';
  t.done = (async () => {
    try {
      // Undone in another tab meanwhile: leave the note alone.
      if (!(id in readStored(t.uid)) && !t.note) {
        trash.delete(id);
        return;
      }
      t.links = await linksOf(id).catch(() => undefined);
      must(await supabase.from('notes').delete().eq('id', id).select('id'));
      t.state = 'committed';
    } catch (err) {
      console.error(err);
      trash.delete(id);
      onError?.();
    } finally {
      writeStored(t.uid, (m) => delete m[id]);
      emit();
      refresh(qc, t.uid, true);
    }
  })();
  return t.done;
}

/** Finishes deletes that another (closed) tab left pending, once per user per load. */
const resumed = new Set<string>();
function resumeTrash(uid: string, qc: QueryClient) {
  if (resumed.has(uid)) return;
  resumed.add(uid);
  for (const [id, due] of Object.entries(readStored(uid))) {
    if (trash.has(id)) continue;
    const entry: TrashEntry = { uid, state: 'pending' };
    trash.set(id, entry);
    entry.timer = window.setTimeout(() => commit(id, qc), Math.max(0, due - Date.now()));
  }
  emit();
}

// Closing or reloading the tab: start every pending delete now. If the request doesn't make it,
// the id is still in localStorage and the next load finishes it.
let pagehideBound = false;
function bindPagehide(qc: QueryClient) {
  if (pagehideBound || typeof window === 'undefined') return;
  pagehideBound = true;
  window.addEventListener('pagehide', () => {
    for (const [id, t] of trash) if (t.state === 'pending') commit(id, qc);
  });
}

/**
 * Deleting a note with Undo. `remove` hides the note and schedules the real delete;
 * `restore` brings back exactly the note that was deleted.
 */
export function useTrashNote() {
  const uid = useUserId();
  const qc = useQueryClient();
  const toastError = useToast();
  bindPagehide(qc);

  const remove = useCallback(
    (note: Note) => {
      if (trash.has(note.id) || note.id.startsWith('temp-')) return;
      const due = Date.now() + NOTE_TRASH_MS;
      const entry: TrashEntry = { uid, note, state: 'pending' };
      trash.set(note.id, entry);
      writeStored(uid, (m) => (m[note.id] = due));
      entry.timer = window.setTimeout(() => commit(note.id, qc, () => toastError('That note could not be deleted, so it is back in your list.')), NOTE_TRASH_MS);
      emit();
    },
    [uid, qc, toastError],
  );

  const restore = useCallback(
    async (id: string) => {
      const t = trash.get(id);
      if (!t) return;
      if (t.state === 'pending') {
        window.clearTimeout(t.timer);
        trash.delete(id);
        writeStored(t.uid, (m) => delete m[id]);
        emit();
        return;
      }
      await t.done;
      const after = trash.get(id);
      if (!after || after.state !== 'committed' || !after.note) return;
      const n = after.note;
      try {
        must(
          await supabase
            .from('notes')
            .insert({ id: n.id, body: n.body, state: n.state, pinned: n.pinned, tags: n.tags, processed_at: n.processed_at, created_at: n.created_at })
            .select('id'),
        );
        const links = after.links;
        if (links)
          await Promise.all(
            (['tasks', 'habits', 'goals'] as const).filter((k) => links[k].length).map((k) => supabase.from(k).update({ source_note_id: n.id }).in('id', links[k])),
          );
      } catch (err) {
        console.error(err);
        toastError('That note could not be restored. Please try again.');
        return;
      }
      trash.delete(id);
      emit();
      refresh(qc, t.uid, true);
    },
    [qc, toastError],
  );

  return { remove, restore };
}
