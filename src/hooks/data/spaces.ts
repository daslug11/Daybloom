import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import {
  ITEM_COLUMNS,
  normalizeValues,
  type ItemValues,
  type LinkPreview,
  type SavedTemplate,
  type Space,
  type SpaceDesign,
  type SpaceItem,
  type SpaceShare,
} from '../../lib/spaces';
import { supabase } from '../../lib/supabase';
import { useUserId } from '../useAuth';
import { useToast } from '../useToast';
import { must } from './cache';

export const spacesKey = (uid: string) => ['spaces', uid];
export const spaceItemsKey = (uid: string, spaceId: string) => ['space_items', uid, spaceId];
export const templatesKey = (uid: string) => ['space_templates', uid];
export const shareKey = (uid: string, spaceId: string) => ['space_share', uid, spaceId];

/** Every Space (active, archived and Atlas drafts), newest-sorted last. */
export function useSpaces() {
  const uid = useUserId();
  return useQuery({
    queryKey: spacesKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('spaces').select('*').order('sort')) as Space[],
    staleTime: 30_000,
  });
}

export function useActiveSpaces() {
  const q = useSpaces();
  return { ...q, data: q.data?.filter((s) => s.status === 'active') };
}

/** All of a Space's items (fetched in pages: the API returns at most 1,000 rows per request). */
async function fetchItems(spaceId: string): Promise<SpaceItem[]> {
  const out: SpaceItem[] = [];
  for (let from = 0; from < 6000; from += 1000) {
    const page = must(await supabase.from('space_items').select(ITEM_COLUMNS).eq('space_id', spaceId).order('position').range(from, from + 999)) as unknown as SpaceItem[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

export function useSpaceItems(spaceId: string | undefined) {
  const uid = useUserId();
  return useQuery({
    queryKey: spaceItemsKey(uid, spaceId ?? ''),
    enabled: !!uid && !!spaceId,
    queryFn: () => fetchItems(spaceId!),
    staleTime: 15_000,
  });
}

export function useSpaceTemplates() {
  const uid = useUserId();
  return useQuery({
    queryKey: templatesKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('space_templates').select('*').order('created_at', { ascending: false })) as SavedTemplate[],
  });
}

export function useSpaceShare(spaceId: string | undefined) {
  const uid = useUserId();
  return useQuery({
    queryKey: shareKey(uid, spaceId ?? ''),
    enabled: !!uid && !!spaceId,
    queryFn: async () => must(await supabase.from('space_shares').select('id, space_id, token, enabled').eq('space_id', spaceId!).maybeSingle()) as SpaceShare | null,
  });
}

// ---------------------------------------------------------------------------
// Space-level changes
// ---------------------------------------------------------------------------
export interface NewSpace {
  name: string;
  emoji: string;
  color: number;
  description?: string;
  design: SpaceDesign;
  settings?: Space['settings'];
  request?: string;
  template_id?: string | null;
  habit_id?: string | null;
  goal_id?: string | null;
  goal_field?: string | null;
}

function friendly(err: unknown): string {
  const msg = (err as Error)?.message ?? '';
  if (/up to 25 active Spaces|Space is full|up to 50 templates|Too many unsaved/.test(msg)) return msg;
  return 'That change could not be saved. Please try again.';
}

export function useSpaceActions() {
  const uid = useUserId();
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: spacesKey(uid) });

  const create = useMutation({
    mutationFn: async ({ space, items }: { space: NewSpace; items?: ItemValues[] }) => {
      const row = must(await supabase.from('spaces').insert({ ...space, status: 'active' }).select('*').single()) as Space;
      if (items?.length) {
        const now = Date.now() / 1000;
        await supabase.from('space_items').insert(items.map((data, i) => ({ space_id: row.id, data: normalizeValues(row.design, data), position: now + i / 1000 })));
      }
      return row;
    },
    onSuccess: refresh,
    onError: (e) => toast(friendly(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Space> }) => must(await supabase.from('spaces').update(patch).eq('id', id).select('*').single()) as Space,
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: spacesKey(uid) });
      const prev = qc.getQueryData<Space[]>(spacesKey(uid));
      if (prev) qc.setQueryData<Space[]>(spacesKey(uid), prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(spacesKey(uid), ctx.prev);
      toast(friendly(e));
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('spaces').delete().eq('id', id).select('id')),
    onMutate: async (id) => {
      const prev = qc.getQueryData<Space[]>(spacesKey(uid));
      if (prev) qc.setQueryData<Space[]>(spacesKey(uid), prev.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(spacesKey(uid), ctx.prev);
      toast(friendly(e));
    },
    onSettled: refresh,
  });

  const saveTemplate = useMutation({
    mutationFn: async (t: Omit<SavedTemplate, 'id' | 'created_at'>) => must(await supabase.from('space_templates').insert(t).select('*').single()) as SavedTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesKey(uid) });
      toast('Saved as a template. It’s under “Your templates” when you make a new Space.');
    },
    onError: (e) => toast(friendly(e)),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('space_templates').delete().eq('id', id).select('id')),
    onSuccess: () => qc.invalidateQueries({ queryKey: templatesKey(uid) }),
  });

  return { create, update, remove, saveTemplate, deleteTemplate };
}

// ---------------------------------------------------------------------------
// Items, with Undo for every change
// ---------------------------------------------------------------------------
type Undo = { label: string; run: () => Promise<void> };
const undoStacks = new Map<string, Undo[]>();

function pushUndo(spaceId: string, u: Undo) {
  const stack = undoStacks.get(spaceId) ?? [];
  stack.push(u);
  if (stack.length > 30) stack.shift();
  undoStacks.set(spaceId, stack);
}

function setItems(qc: QueryClient, uid: string, spaceId: string, fn: (list: SpaceItem[]) => SpaceItem[]) {
  qc.setQueryData<SpaceItem[]>(spaceItemsKey(uid, spaceId), (prev) => fn(prev ?? []));
}

export function useItemActions(spaceId: string) {
  const uid = useUserId();
  const qc = useQueryClient();
  const toast = useToast();
  const key = spaceItemsKey(uid, spaceId);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    // Linked habits and goals update in the database when items change.
    qc.invalidateQueries({ queryKey: ['habit_logs', uid] });
    qc.invalidateQueries({ queryKey: ['goals', uid] });
  };
  const fail = (e: unknown) => {
    console.error(e);
    toast(friendly(e));
    qc.invalidateQueries({ queryKey: key });
  };

  const undoLast = useCallback(async () => {
    const u = undoStacks.get(spaceId)?.pop();
    if (!u) return false;
    try {
      await u.run();
      toast(`Undone: ${u.label}`);
    } catch (e) {
      fail(e);
    }
    refresh();
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  /** Records an undo step and shows a toast offering it. */
  const done = (label: string, run: () => Promise<void>, quiet = false) => {
    pushUndo(spaceId, { label, run });
    if (!quiet) toast(label, { label: 'Undo', onClick: () => void undoLast() });
  };

  const rawDelete = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 200) must(await supabase.from('space_items').delete().in('id', ids.slice(i, i + 200)).select('id'));
  };
  const rawInsert = async (rows: Partial<SpaceItem>[]) => {
    const out: SpaceItem[] = [];
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ ...(r.id ? { id: r.id } : {}), space_id: spaceId, data: r.values ?? {}, meta: r.meta ?? {}, position: r.position, ...(r.created_at ? { created_at: r.created_at } : {}) }));
      out.push(...((must(await supabase.from('space_items').insert(chunk).select(ITEM_COLUMNS)) as unknown) as SpaceItem[]));
    }
    return out;
  };

  /** Adds items (quick add, paste, suggestions). Returns the saved rows. */
  const add = async (values: ItemValues[], label?: string, opts: { quiet?: boolean } = {}) => {
    if (!values.length) return [];
    const now = Date.now() / 1000;
    const temp = values.map((v, i) => ({ id: `temp-${now}-${i}`, space_id: spaceId, values: v, meta: {}, position: now + i / 1000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    setItems(qc, uid, spaceId, (list) => [...list, ...temp]);
    try {
      const saved = await rawInsert(temp.map(({ values: v, position }) => ({ values: v, position })));
      setItems(qc, uid, spaceId, (list) => [...list.filter((i) => !i.id.startsWith(`temp-${now}-`)), ...saved]);
      done(label ?? (saved.length === 1 ? 'Added 1 item' : `Added ${saved.length} items`), () => rawDelete(saved.map((s) => s.id)), opts.quiet);
      refresh();
      return saved;
    } catch (e) {
      fail(e);
      return [];
    }
  };

  /** Changes values on one or more items (inline edits, check off, bulk tag). */
  const update = async (changes: { id: string; values: ItemValues; meta?: SpaceItem['meta'] }[], label: string, opts: { quiet?: boolean } = {}) => {
    const list = qc.getQueryData<SpaceItem[]>(key) ?? [];
    const before = changes.map((c) => list.find((i) => i.id === c.id)).filter((i): i is SpaceItem => !!i);
    if (!before.length) return;
    setItems(qc, uid, spaceId, (l) => l.map((i) => {
      const c = changes.find((x) => x.id === i.id);
      return c ? { ...i, values: c.values, meta: c.meta ?? i.meta } : i;
    }));
    try {
      await Promise.all(changes.map((c) => supabase.from('space_items').update({ data: c.values, ...(c.meta ? { meta: c.meta } : {}) }).eq('id', c.id).then(must)));
      done(label, async () => {
        await Promise.all(before.map((b) => supabase.from('space_items').update({ data: b.values, meta: b.meta }).eq('id', b.id).then(must)));
      }, opts.quiet);
      refresh();
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (ids: string[], label?: string) => {
    const list = qc.getQueryData<SpaceItem[]>(key) ?? [];
    const gone = list.filter((i) => ids.includes(i.id));
    if (!gone.length) return;
    setItems(qc, uid, spaceId, (l) => l.filter((i) => !ids.includes(i.id)));
    try {
      await rawDelete(gone.map((g) => g.id));
      done(label ?? (gone.length === 1 ? 'Deleted 1 item' : `Deleted ${gone.length} items`), async () => {
        await rawInsert(gone);
      });
      refresh();
    } catch (e) {
      fail(e);
    }
  };

  const reorder = async (id: string, position: number) => {
    const list = qc.getQueryData<SpaceItem[]>(key) ?? [];
    const item = list.find((i) => i.id === id);
    if (!item) return;
    const old = item.position;
    setItems(qc, uid, spaceId, (l) => l.map((i) => (i.id === id ? { ...i, position } : i)).sort((a, b) => a.position - b.position));
    try {
      must(await supabase.from('space_items').update({ position }).eq('id', id).select('id'));
      done('Moved item', async () => void must(await supabase.from('space_items').update({ position: old }).eq('id', id).select('id')), true);
    } catch (e) {
      fail(e);
    }
  };

  /** Moves items to another Space, re-keying values to its design. */
  const move = async (ids: string[], to: Space, remap: (values: ItemValues) => ItemValues) => {
    const list = qc.getQueryData<SpaceItem[]>(key) ?? [];
    const moving = list.filter((i) => ids.includes(i.id));
    if (!moving.length) return;
    setItems(qc, uid, spaceId, (l) => l.filter((i) => !ids.includes(i.id)));
    try {
      const now = Date.now() / 1000;
      await Promise.all(moving.map((m, i) => supabase.from('space_items').update({ space_id: to.id, data: remap(m.values), position: now + i / 1000 }).eq('id', m.id).then(must)));
      done(`Moved ${moving.length === 1 ? '1 item' : `${moving.length} items`} to ${to.name}`, async () => {
        await Promise.all(moving.map((m) => supabase.from('space_items').update({ space_id: spaceId, data: m.values, position: m.position }).eq('id', m.id).then(must)));
        qc.invalidateQueries({ queryKey: spaceItemsKey(uid, to.id) });
      });
      qc.invalidateQueries({ queryKey: spaceItemsKey(uid, to.id) });
      refresh();
    } catch (e) {
      fail(e);
    }
  };

  return { add, update, remove, reorder, move, undoLast };
}

/** Adds items to any Space from outside its page (Brain Dump, ⌘K, plan cards). */
export function useAddToSpace() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ space, values }: { space: Space; values: ItemValues[] }) => {
      const now = Date.now() / 1000;
      return must(
        await supabase
          .from('space_items')
          .insert(values.map((v, i) => ({ space_id: space.id, data: normalizeValues(space.design, v), position: now + i / 1000 })))
          .select(ITEM_COLUMNS),
      ) as unknown as SpaceItem[];
    },
    onSuccess: (_d, { space }) => {
      qc.invalidateQueries({ queryKey: spaceItemsKey(uid, space.id) });
      qc.invalidateQueries({ queryKey: ['habit_logs', uid] });
      qc.invalidateQueries({ queryKey: ['goals', uid] });
    },
  });
}

/** Link preview through our server (no AI). */
export function fetchLinkPreview(url: string) {
  return apiFetch<{ preview: LinkPreview }>('/api/spaces', { action: 'preview', url }).then((r) => r.preview);
}
