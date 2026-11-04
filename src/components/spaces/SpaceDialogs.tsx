/** Dialogs on a Space: share, settings, move, item actions and the ✨ smart actions. */
import { Archive, Check, Copy, CopyPlus, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useGoals } from '../../hooks/data/goals';
import { useHabits } from '../../hooks/data/habits';
import { shareKey, useAddToSpace, useSpaceActions, useActiveSpaces, useSpaceShare } from '../../hooks/data/spaces';
import { useAi } from '../../hooks/useAi';
import { useUserId } from '../../hooks/useAuth';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import {
  defaultValues,
  itemTitle,
  normalizeDesign,
  parseList,
  normalizeValues,
  publicFields,
  shareUrl,
  type ItemValues,
  type Space,
  type SpaceDesign,
  type SpaceItem,
} from '../../lib/spaces';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { AiButton } from '../ui/Ai';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { PreviewEditor, type DraftSpace } from './PreviewEditor';
import { SpaceIcon } from './fields';

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------
export function ShareDialog({ space, open, onClose, onDesign }: { space: Space; open: boolean; onClose: () => void; onDesign: (d: SpaceDesign) => void }) {
  const uid = useUserId();
  const qc = useQueryClient();
  const toast = useToast();
  const share = useSpaceShare(open ? space.id : undefined);
  const [busy, setBusy] = useState(false);
  const link = share.data?.enabled ? shareUrl(share.data.token) : null;
  const shown = publicFields(space.design);
  const refresh = () => qc.invalidateQueries({ queryKey: shareKey(uid, space.id) });

  const turnOn = async () => {
    setBusy(true);
    const { error } = share.data ? await supabase.from('space_shares').update({ enabled: true }).eq('id', share.data.id) : await supabase.from('space_shares').insert({ space_id: space.id });
    setBusy(false);
    if (error) return toast('The link couldn’t be created. Please try again.');
    refresh();
  };
  const turnOff = async () => {
    if (!share.data) return;
    setBusy(true);
    await supabase.from('space_shares').update({ enabled: false }).eq('id', share.data.id);
    setBusy(false);
    refresh();
    toast('Link turned off. Anyone who opens it now sees “This link has been turned off”.');
  };
  const newLink = async () => {
    if (!share.data) return;
    setBusy(true);
    await supabase.from('space_shares').delete().eq('id', share.data.id);
    await supabase.from('space_shares').insert({ space_id: space.id });
    setBusy(false);
    refresh();
    toast('New link made. The old one no longer works.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Share a read-only link" description="Anyone with the link can view this Space. They can’t edit it, and they don’t see your name or account.">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Link sharing</p>
            <p className="text-xs text-muted">{link ? 'On · you can turn it off at any time' : 'Off'}</p>
          </div>
          <Switch checked={!!link} disabled={busy || share.isLoading} onChange={(v) => (v ? turnOn() : turnOff())} label="Link sharing" />
        </div>
        {link && (
          <div className="flex gap-2">
            <input readOnly className="input font-mono !text-xs" value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn-primary shrink-0"
              onClick={async () => {
                try {
                  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ title: space.name, url: link });
                  else {
                    await navigator.clipboard.writeText(link);
                    toast('Link copied.');
                  }
                } catch {
                  /* cancelled */
                }
              }}
            >
              <Copy size={15} aria-hidden /> Copy
            </button>
          </div>
        )}
        <div>
          <p className="label">What people see</p>
          <ul className="divide-y divide-line rounded-card border border-line">
            {space.design.fields.map((f) => {
              const visible = shown.some((x) => x.key === f.key);
              return (
                <li key={f.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  {f.type === 'computed' && !visible && !f.private ? (
                    <span className="text-xs text-faint">Hidden (uses a hidden field)</span>
                  ) : (
                    <Switch checked={visible} onChange={(on) => onDesign(normalizeDesign({ ...space.design, fields: space.design.fields.map((x) => (x.key === f.key ? { ...x, private: !on } : x)) }, space.design).design)} label={`Show ${f.name} on the shared page`} />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Budgets are never shared. Shared pages aren’t listed by search engines.</p>
        </div>
        {link && (
          <button type="button" className="btn-ghost w-full" onClick={newLink} disabled={busy}>
            <RotateCcw size={15} aria-hidden /> Make a new link (the old one stops working)
          </button>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function SettingsDialog({ space, items, open, onClose, onEditDesign, onResetAll }: { space: Space; items: SpaceItem[]; open: boolean; onClose: () => void; onEditDesign: () => void; onResetAll: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const habits = useHabits();
  const goals = useGoals();
  const { update, create, remove, saveTemplate } = useSpaceActions();
  const [confirmDelete, setConfirmDelete] = useState('');
  const set = (patch: Partial<Space>) => update.mutate({ id: space.id, patch });
  const setSetting = (patch: Partial<Space['settings']>) => set({ settings: { ...space.settings, ...patch } });
  const dateFields = space.design.fields.filter((f) => f.type === 'date');
  const numFields = space.design.fields.filter((f) => ['number', 'money', 'duration', 'checkbox'].includes(f.type));
  const checked = space.design.check ? items.filter((i) => i.values[space.design.check!] === true).length : 0;

  return (
    <Modal open={open} onClose={onClose} title={`${space.emoji} ${space.name}`} description="Settings for this Space." className="sm:max-w-xl">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Design</h3>
          <button type="button" className="btn-ghost w-full justify-start" onClick={onEditDesign}>
            <Pencil size={15} aria-hidden /> Edit fields, views and cards
          </button>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">Pin to Dashboard</p>
              <p className="text-xs text-muted">Shows its first summary card on the Dashboard.</p>
            </div>
            <Switch checked={!!space.settings.pinned} onChange={(v) => setSetting({ pinned: v })} label="Pin to Dashboard" />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Habits and goals</h3>
          <p className="-mt-2 text-xs text-muted">Each item you add counts toward them automatically.</p>
          <label className="block">
            <span className="label">Linked habit</span>
            <select className="input" value={space.habit_id ?? ''} onChange={(e) => set({ habit_id: e.target.value || null })}>
              <option value="">None</option>
              {(habits.data ?? []).map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
            </select>
            <span className="mt-1 block text-xs text-muted">Logging an item ticks the habit off for that day.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Linked goal</span>
              <select className="input" value={space.goal_id ?? ''} onChange={(e) => set({ goal_id: e.target.value || null })}>
                <option value="">None</option>
                {(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Each item adds</span>
              <select className="input" value={space.goal_field ?? ''} disabled={!space.goal_id} onChange={(e) => set({ goal_field: e.target.value || null })}>
                <option value="">1 (counts items)</option>
                {numFields.map((f) => <option key={f.key} value={f.key}>{f.name}{f.type === 'duration' ? ' (minutes)' : ''}</option>)}
              </select>
            </label>
          </div>
        </section>

        {dateFields.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Planner and reminders</h3>
            <label className="block">
              <span className="label">Show items in the Planner by</span>
              <select className="input" value={space.settings.planner_field ?? ''} onChange={(e) => setSetting({ planner_field: e.target.value || null })}>
                <option value="">Don’t show</option>
                {dateFields.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Remind me before</span>
                <select className="input" value={space.settings.reminder_field ?? ''} onChange={(e) => setSetting({ reminder_field: e.target.value || null, reminder_days: space.settings.reminder_days ?? 1 })}>
                  <option value="">No reminders</option>
                  {dateFields.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">How early</span>
                <select className="input" value={space.settings.reminder_days ?? 1} disabled={!space.settings.reminder_field} onChange={(e) => setSetting({ reminder_days: Number(e.target.value) })}>
                  {[0, 1, 2, 3, 7, 14].map((d) => <option key={d} value={d}>{d === 0 ? 'On the day' : d === 1 ? '1 day before' : `${d} days before`}</option>)}
                </select>
              </label>
            </div>
            {space.settings.reminder_field && typeof Notification !== 'undefined' && Notification.permission === 'default' && (
              <button type="button" className="btn-ghost w-full" onClick={() => Notification.requestPermission()}>Also show browser notifications</button>
            )}
            <p className="text-xs text-muted">Reminders appear in Daybloom (and as browser notifications if you allow them) while Daybloom is open.</p>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">More</h3>
          {space.design.check && (
            <button type="button" className="btn-ghost w-full justify-start" disabled={!checked} onClick={() => (onClose(), onResetAll())}>
              <RotateCcw size={15} aria-hidden /> Reset all ({checked} ticked) — for packing lists and routines
            </button>
          )}
          <button type="button" className="btn-ghost w-full justify-start" onClick={() => saveTemplate.mutate({ name: space.name, emoji: space.emoji, color: space.color, description: space.description, design: space.design, settings: {} })}>
            <CopyPlus size={15} aria-hidden /> Save as my template
          </button>
          <button
            type="button"
            className="btn-ghost w-full justify-start"
            onClick={async () => {
              const copy = await create.mutateAsync({ space: { name: `${space.name} (copy)`.slice(0, 60), emoji: space.emoji, color: space.color, description: space.description, design: space.design, template_id: space.template_id, settings: {} }, items: items.slice(0, 5000).map((i) => i.values) }).catch(() => null);
              if (copy) {
                onClose();
                toast(`Duplicated as “${copy.name}”.`);
                navigate(`/app/spaces/${copy.id}`);
              }
            }}
          >
            <Copy size={15} aria-hidden /> Duplicate this Space
          </button>
          <button type="button" className="btn-ghost w-full justify-start" onClick={() => (set({ status: space.status === 'archived' ? 'active' : 'archived' }), onClose(), toast(space.status === 'archived' ? 'Restored.' : 'Archived. Find it under Archived on the Spaces page.'))}>
            <Archive size={15} aria-hidden /> {space.status === 'archived' ? 'Restore from archive' : 'Archive (keeps everything, frees a slot)'}
          </button>
        </section>

        <section className="space-y-2 rounded-card border border-danger/30 p-3">
          <h3 className="text-sm font-semibold text-danger">Delete Space</h3>
          <p className="text-xs text-muted">Deletes the Space and its {items.length} item{items.length === 1 ? '' : 's'} for good. This can’t be undone. Type the name to confirm.</p>
          <div className="flex gap-2">
            <input className="input" aria-label="Type the Space name to confirm" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder={space.name} />
            <button type="button" className="btn-danger shrink-0" disabled={confirmDelete.trim() !== space.name.trim()} onClick={async () => {
              await remove.mutateAsync(space.id).catch(() => null);
              onClose();
              toast(`Deleted “${space.name}”.`);
              navigate('/app/spaces');
            }}>
              <Trash2 size={15} aria-hidden /> Delete
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit design (no AI) and ✨ Redesign (with preview)
// ---------------------------------------------------------------------------
export function DesignDialog({ space, open, onClose, initial, title, note, items }: { space: Space; open: boolean; onClose: () => void; initial?: DraftSpace; title?: string; note?: string; items: SpaceItem[] }) {
  const { update } = useSpaceActions();
  const toast = useToast();
  const [draft, setDraft] = useState<DraftSpace>(() => initial ?? { name: space.name, emoji: space.emoji, color: space.color, description: space.description, design: space.design, samples: items.slice(0, 3).map((i) => i.values) });
  const removed = space.design.fields.filter((f) => !draft.design.fields.some((x) => x.key === f.key));
  const affected = removed.length ? items.filter((i) => removed.some((f) => i.values[f.key] !== undefined)).length : 0;
  return (
    <Modal open={open} onClose={onClose} title={title ?? 'Edit design'} description={note ?? 'The preview uses a few of your own items. Nothing changes until you save.'} className="sm:max-w-6xl">
      <PreviewEditor draft={draft} onChange={setDraft} customise />
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-overlay px-6 py-4">
        {removed.length > 0 && <p className="mr-auto text-xs text-warning">Removing {removed.map((f) => `“${f.name}”`).join(', ')} hides that data{affected ? ` on ${affected} item${affected === 1 ? '' : 's'}` : ''}. Undo is in the toast after saving.</p>}
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            const before = { name: space.name, emoji: space.emoji, color: space.color, design: space.design };
            const saved = await update.mutateAsync({ id: space.id, patch: { name: draft.name.trim() || space.name, emoji: draft.emoji, color: draft.color, design: draft.design } }).catch(() => null);
            if (saved) {
              onClose();
              toast('Design saved.', { label: 'Undo', onClick: () => update.mutate({ id: space.id, patch: before }) });
            }
          }}
        >
          <Check size={15} aria-hidden /> Save design
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Move items to another Space
// ---------------------------------------------------------------------------
export function MoveDialog({ space, count, open, onClose, onMove }: { space: Space; count: number; open: boolean; onClose: () => void; onMove: (to: Space) => void }) {
  const spaces = useActiveSpaces();
  const others = (spaces.data ?? []).filter((s) => s.id !== space.id);
  return (
    <Modal open={open} onClose={onClose} title={`Move ${count === 1 ? 'item' : `${count} items`} to…`} description="Fields with the same name carry over; anything else stays behind in the item’s history.">
      {others.length === 0 ? (
        <p className="text-sm text-muted">You don’t have another Space yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {others.map((s) => (
            <li key={s.id}>
              <button type="button" className="flex w-full items-center gap-3 rounded-control border border-line px-3 py-2.5 text-left hover:border-line-strong hover:bg-raised" onClick={() => (onClose(), onMove(s))}>
                <SpaceIcon emoji={s.emoji} color={s.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ✨ Smart actions: suggest, insights, ask (each is one AI action)
// ---------------------------------------------------------------------------
type Smart = 'suggest' | 'insights' | 'ask';

export function SmartDialog({ space, kind, onClose, onAdd, onRedesign }: { space: Space; kind: Smart | 'redesign' | null; onClose: () => void; onAdd: (values: ItemValues[]) => void; onRedesign: (d: DraftSpace) => void }) {
  const suggest = useAi<{ items: ItemValues[]; note: string }>('space_suggest');
  const insights = useAi<{ headline: string; points: string[] }>('space_insights');
  const ask = useAi<{ answer: string }>('space_ask');
  const redesign = useAi<{ name: string; emoji: string; color: number; description: string; design: SpaceDesign; samples: ItemValues[]; dropped: string[] }>('space_design');
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const titles: Record<string, string> = { suggest: '✨ Suggest items', insights: '✨ Insights', ask: '✨ Ask this Space', redesign: '✨ Redesign' };
  const descs: Record<string, string> = {
    suggest: 'Ideas based on what’s already here, including your own notes. Pick the ones you want.',
    insights: 'A short, honest summary worked out from this Space’s own numbers.',
    ask: 'A quick question, answered only from this Space’s data.',
    redesign: 'Describe the change, like “add a size field” or “track pace too”. You’ll see a preview first.',
  };
  const primary = space.design.fields.find((f) => f.key === space.design.primary);
  const close = () => {
    suggest.reset();
    ask.reset();
    redesign.reset();
    setText('');
    setPicked(new Set());
    onClose();
  };
  if (!kind) return null;
  return (
    <Modal open={!!kind} onClose={close} title={titles[kind]} description={descs[kind]}>
      {(kind === 'suggest' || kind === 'ask' || kind === 'redesign') && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (kind === 'suggest') suggest.mutate({ space_id: space.id, prompt: text });
            if (kind === 'ask' && text.trim()) ask.mutate({ space_id: space.id, question: text.trim() });
            if (kind === 'redesign' && text.trim()) redesign.mutate({ space_id: space.id, request: text.trim() }, { onSuccess: (r) => onRedesign({ name: space.name, emoji: space.emoji, color: space.color, description: space.description, design: r.result.design, samples: [] }) });
          }}
        >
          <label htmlFor="smart-text" className="sr-only">{kind === 'ask' ? 'Question' : kind === 'redesign' ? 'Change' : 'Focus (optional)'}</label>
          <input id="smart-text" className="input flex-1" maxLength={kind === 'ask' ? 300 : 500} value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={kind === 'ask' ? 'How much have I spent on Dad?' : kind === 'redesign' ? 'Add a size field' : 'Optional: for Dad, under $30…'} />
          <AiButton onClick={() => (document.getElementById('smart-text') as HTMLInputElement)?.form?.requestSubmit()} loading={suggest.isPending || ask.isPending || redesign.isPending} disabled={kind !== 'suggest' && !text.trim()}>
            {kind === 'ask' ? 'Ask' : kind === 'redesign' ? 'Preview' : 'Suggest'}
          </AiButton>
        </form>
      )}
      {kind === 'insights' && !insights.data && (
        <AiButton onClick={() => insights.mutate({ space_id: space.id })} loading={insights.isPending}>Get insights</AiButton>
      )}
      {kind === 'insights' && insights.data && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{insights.data.result.headline}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {insights.data.result.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="text-xs text-faint">{insights.data.cached ? 'Saved from earlier (didn’t use an AI action). ' : ''}Worked out from your items; check anything important.</p>
          <button type="button" className="link text-xs" onClick={() => insights.mutate({ space_id: space.id, force: true })}>Refresh</button>
        </div>
      )}
      {kind === 'ask' && ask.data && <p className="mt-4 rounded-card border border-atlas/30 bg-atlas/[0.05] p-3 text-sm">{ask.data.result.answer}</p>}
      {kind === 'suggest' && suggest.data && (
        <div className="mt-4 space-y-2">
          {suggest.data.result.note && <p className="text-xs text-muted">{suggest.data.result.note}</p>}
          <ul className="space-y-1.5">
            {suggest.data.result.items.map((v, i) => (
              <li key={i}>
                <label className={cn('flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm', picked.has(i) ? 'border-ink/50 bg-ink/[0.04]' : 'border-line')}>
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--ink))]" checked={picked.has(i)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                  <span className="min-w-0 flex-1 truncate">{primary ? String(v[primary.key] ?? itemTitle(space.design, { id: '', values: v })) : itemTitle(space.design, { id: '', values: v })}</span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary w-full" disabled={!picked.size} onClick={() => { onAdd(suggest.data!.result.items.filter((_, i) => picked.has(i)).map((v) => normalizeValues(space.design, v))); close(); }}>
            Add {picked.size || ''} selected
          </button>
        </div>
      )}
      {kind === 'redesign' && redesign.data && redesign.data.result.dropped.length > 0 && <p className="mt-3 text-xs text-muted">Left out: {redesign.data.result.dropped.join('; ')}</p>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Send something (a note, selected text) to a Space
// ---------------------------------------------------------------------------
export function SendToSpaceDialog({ open, text, onClose, onSent, suggested }: { open: boolean; text: string; onClose: () => void; onSent?: (space: Space) => void; suggested?: string | null }) {
  const spaces = useActiveSpaces();
  const add = useAddToSpace();
  const toast = useToast();
  const navigate = useNavigate();
  const { today } = useToday();
  const [body, setBody] = useState(text);
  const [last, setLast] = useState(text);
  if (text !== last) {
    setLast(text);
    setBody(text);
  }
  const list = [...(spaces.data ?? [])].sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0));
  return (
    <Modal open={open} onClose={onClose} title="Send to a Space" description="Each line becomes an item, read with that Space’s fields (no AI).">
      <label htmlFor="send-text" className="label">Text</label>
      <textarea id="send-text" className="input min-h-[80px]" value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="label mt-4">Space</p>
      {list.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong p-4 text-sm text-muted">
          You don’t have any Spaces yet.{' '}
          <button type="button" className="link" onClick={() => (onClose(), navigate(`/app/spaces/new?describe=${encodeURIComponent(body.slice(0, 200))}`))}>Make one from this</button>
        </div>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {list.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={add.isPending || !body.trim()}
                className="flex w-full items-center gap-3 rounded-control border border-line px-3 py-2.5 text-left hover:border-line-strong hover:bg-raised disabled:opacity-50"
                onClick={async () => {
                  const rows = parseList(body, s.design, { today }).map((r) => ({ ...defaultValues(s.design, today), ...r.values }));
                  if (!rows.length) return;
                  const saved = await add.mutateAsync({ space: s, values: rows }).catch(() => null);
                  if (!saved) return toast('That couldn’t be added. Please try again.');
                  onClose();
                  onSent?.(s);
                  toast(`Added ${saved.length === 1 ? `“${itemTitle(s.design, saved[0])}”` : `${saved.length} items`} to ${s.emoji} ${s.name}.`, { label: 'Open', onClick: () => navigate(`/app/spaces/${s.id}`) });
                }}
              >
                <SpaceIcon emoji={s.emoji} color={s.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                {s.id === suggested && <span className="shrink-0 rounded-full border border-atlas/40 px-2 py-0.5 text-xs text-atlas">✨ Suggested</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

