import { History, Mic, MicOff, Search, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { draftKey, loadSession, saveSession } from '../../components/capture/sessionDraft';
import { ExtractPanel, OrganizePanel, PatternsPanel, PlanPanel, SummaryPanel, type Suggestion } from '../../components/notes/AiNotePanels';
import { ConvertDialog, type ConvertKind } from '../../components/notes/ConvertDialog';
import { NoteCard, type NoteAiAction } from '../../components/notes/NoteCard';
import { movedLabel } from '../../components/notes/outcomes';
import { ProcessInbox } from '../../components/notes/ProcessInbox';
import { AiAllowance, AiButton } from '../../components/ui/Ai';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, QueryState } from '../../components/ui/States';
import { useGoals } from '../../hooks/data/goals';
import { useHabits } from '../../hooks/data/habits';
import { useAddNote, useDeleteNote, useNotes, useUpdateNote } from '../../hooks/data/notes';
import { useTasks } from '../../hooks/data/tasks';
import { useAi, useAiStatus } from '../../hooks/useAi';
import { useUserId } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { createRecognizer, speechInputSupported, type Recognizer } from '../../lib/speech';
import type { Note, NoteState, Priority } from '../../lib/types';
import { cn } from '../../lib/utils';

type View = 'inbox' | 'ideas' | 'all' | 'archive';
const VIEWS: { id: View; label: string; hint: string; empty: { emoji: string; title: string; body: string } }[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    hint: 'New captures waiting to be sorted.',
    empty: { emoji: '📥', title: 'Your inbox is empty', body: 'Everything you capture (N, the + button, voice, or the box above) lands here until you decide what it is.' },
  },
  {
    id: 'ideas',
    label: 'Ideas',
    hint: 'Things you might do one day.',
    empty: { emoji: '💡', title: 'No ideas saved yet', body: 'When processing your inbox, choose “Keep as idea” for things worth revisiting. ✨ Turn into a plan when one is ready.' },
  },
  { id: 'all', label: 'All notes', hint: 'Everything except the archive.', empty: { emoji: '🗒️', title: 'No notes yet', body: 'Capture your first thought in the box above.' } },
  { id: 'archive', label: 'Archive', hint: 'Processed and archived notes.', empty: { emoji: '🗄️', title: 'Archive is empty', body: 'Notes you archive (or turn into tasks) end up here, still searchable and linked.' } },
];
/** One ✨ result at a time; kept after closing so a paid answer can be reopened. */
type Panel =
  | { type: 'organize'; suggestions: Suggestion[] }
  | { type: 'extract'; note: Note; actions: { title: string; due_date: string | null; priority: Priority | null }[] }
  | { type: 'summary'; title: string; summary: string; keyPoints: string[] }
  | { type: 'patterns'; themes: { theme: string; evidence: string; suggestion: string }[] }
  | { type: 'plan'; note: Note; plan: { title: string; steps: { title: string; estimate_min: number | null }[] } };
const PANEL_NAME: Record<Panel['type'], string> = { organize: 'suggested organization', extract: 'actions found', summary: 'summary', patterns: 'patterns', plan: 'plan' };

const inView = (n: Note, v: View) => (v === 'inbox' ? n.state === 'inbox' : v === 'ideas' ? n.state === 'idea' : v === 'archive' ? n.state === 'archived' : n.state !== 'archived');

export default function BrainDump() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.some((v) => v.id === params.get('view')) ? params.get('view') : 'inbox') as View;
  const focusNote = params.get('note');
  const notes = useNotes();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: goals = [] } = useGoals();
  const addNote = useAddNote();
  const update = useUpdateNote();
  const del = useDeleteNote();
  const toast = useToast();
  const ai = useAiStatus();
  const aiOff = !!ai.data && (!ai.data.enabled || ai.data.remaining <= 0);

  const uid = useUserId();
  const draftId = draftKey('dump-draft', uid);
  const lastKey = draftKey('last-ai-result', uid);
  // The inline draft survives leaving the page (this tab only) until it's saved.
  const [text, setText] = useState(() => loadSession<string>(draftId) ?? '');
  useEffect(() => saveSession(draftId, text.trim() ? text : null), [draftId, text]);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [processing, setProcessing] = useState(params.get('process') === '1');
  const [convert, setConvert] = useState<{ note: Note; kind: ConvertKind; selection: string } | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: NoteAiAction } | null>(null);
  const [panel, setPanelState] = useState<Panel | null>(null);
  // The last ✨ result stays reopenable after closing, until its suggestion is acted on.
  const [lastPanel, setLastPanel] = useState<Panel | null>(() => loadSession<Panel>(lastKey));
  const setPanel = (p: Panel) => {
    setPanelState(p);
    setLastPanel(p);
    saveSession(lastKey, p);
  };
  const closePanel = (committed?: boolean) => {
    setPanelState(null);
    if (committed) {
      setLastPanel(null);
      saveSession(lastKey, null);
    }
  };
  const [listening, setListening] = useState(false);
  const recognizer = useRef<Recognizer | null>(null);
  const selection = useRef<{ noteId: string; text: string } | null>(null);

  const organize = useAi<{ suggestions: Suggestion[] }>('organize_inbox');
  const extract = useAi<{ actions: { title: string; due_date: string | null; priority: Priority | null }[] }>('extract_actions');
  const summarize = useAi<{ summary: string; key_points: string[] }>('summarize');
  const patterns = useAi<{ themes: { theme: string; evidence: string; suggestion: string }[] }>('find_patterns');
  const plan = useAi<{ title: string; steps: { title: string; estimate_min: number | null }[] }>('plan_from_idea');

  // Remember text selected inside a note so "Convert" can use just that part.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const node = sel?.anchorNode?.parentElement?.closest('[data-note-id]');
      const value = sel?.toString().trim() ?? '';
      if (node && value) selection.current = { noteId: node.getAttribute('data-note-id')!, text: value };
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  useEffect(() => {
    if (focusNote) document.getElementById(`note-${focusNote}`)?.scrollIntoView({ block: 'center' });
  }, [focusNote, notes.data]);

  const all = useMemo(() => notes.data ?? [], [notes.data]);
  // A capture that just landed gets a quick fade-in. Only this tab's new notes carry a temporary
  // id (until the save returns), so this never replays for notes already on the page.
  const landed = (id: string) => id.startsWith('temp-');
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.id, all.filter((n) => inView(n, v.id)).length])) as Record<View, number>, [all]);
  const q = query.trim().toLowerCase();
  // Search looks across every note (all views); otherwise show the current view.
  const shown = all.filter((n) => (q ? n.body.toLowerCase().includes(q) : inView(n, view)) && (!tag || n.tags.includes(tag)));
  const viewTags = new Set(all.filter((n) => (q ? true : inView(n, view))).flatMap((n) => n.tags));
  // The active tag always stays visible (with a way to clear it), even if this view has none of it.
  if (tag) viewTags.add(tag);
  const tags = [...viewTags].sort();
  const clearFilters = () => (setQuery(''), setTag(null));

  const linkText = (id: string) => {
    const t = tasks.filter((x) => x.source_note_id === id).length;
    const h = habits.filter((x) => x.source_note_id === id).length;
    const g = goals.filter((x) => x.source_note_id === id).length;
    return [t && `${t} task${t > 1 ? 's' : ''}`, h && `${h} habit${h > 1 ? 's' : ''}`, g && `${g} goal${g > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || undefined;
  };

  const setView = (v: View) => {
    setTag(null);
    setParams((p) => (p.set('view', v), p.delete('note'), p));
  };

  const capture = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    recognizer.current?.stop();
    addNote.mutate({ body: text.trim() });
    setText('');
    if (view !== 'inbox' && view !== 'all') setView('inbox');
  };

  const toggleVoice = () => {
    if (listening) return recognizer.current?.stop();
    const base = text ? text.replace(/\s*$/, ' ') : '';
    let acc = base;
    recognizer.current = createRecognizer({
      continuous: true,
      onText: (t, isFinal) => {
        setText(acc + t);
        if (isFinal) acc = acc + t + ' ';
      },
      onEnd: () => setListening(false),
      onError: (m) => toast(m),
    });
    if (!recognizer.current) return toast("Voice input isn't supported in this browser.");
    setListening(true);
    recognizer.current.start();
  };

  const changeNote = (n: Note, patch: Partial<Note>) => {
    update.mutate({ id: n.id, patch });
    if (patch.state && patch.state !== n.state) {
      const prev: NoteState = n.state;
      toast(movedLabel(patch.state, prev), { label: 'Undo', onClick: () => update.mutate({ id: n.id, patch: { state: prev } }) });
    }
  };

  const remove = (n: Note) => {
    del.mutate(n.id);
    toast('Note deleted', { label: 'Undo', onClick: () => addNote.mutate({ body: n.body, state: n.state }) });
  };

  const runAi = (n: Note, action: NoteAiAction) => {
    setBusy({ id: n.id, action });
    const done = () => setBusy(null);
    if (action === 'extract') extract.mutate({ note_id: n.id }, { onSuccess: (r) => setPanel({ type: 'extract', note: n, actions: r.result.actions }), onSettled: done });
    if (action === 'summarize')
      summarize.mutate({ note_id: n.id }, { onSuccess: (r) => setPanel({ type: 'summary', title: 'Summary', summary: r.result.summary, keyPoints: r.result.key_points }), onSettled: done });
    if (action === 'plan') plan.mutate({ note_id: n.id }, { onSuccess: (r) => setPanel({ type: 'plan', note: n, plan: r.result }), onSettled: done });
  };

  const viewMeta = VIEWS.find((v) => v.id === view)!;

  return (
    <div>
      <PageHeader
        title="Brain Dump"
        description="Empty your head here. Everything lands in the Inbox; process it into tasks, time blocks, goals and ideas — or let ✨ AI suggest how to sort it."
        actions={<AiAllowance className="sm:hidden" />}
      />

      <form onSubmit={capture} className="card mb-5 p-3" data-tour="brain-dump-capture">
        <label htmlFor="dump" className="sr-only">
          New note
        </label>
        <textarea
          id="dump"
          rows={3}
          value={text}
          maxLength={20000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) capture();
          }}
          placeholder="What’s on your mind? Ideas, worries, things to buy, notes from a call…"
          aria-describedby="dump-help"
          className="w-full resize-y bg-transparent text-sm outline-none placeholder:text-faint"
        />
        <p id="dump-help" className="faint text-xs">
          Markdown, - [ ] checklists and #tags work.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleVoice}
            disabled={!speechInputSupported()}
            className={cn('icon-btn', listening && '!bg-danger/15 !text-danger')}
            aria-label={listening ? 'Stop dictating' : 'Dictate a note'}
            aria-pressed={listening}
            title={speechInputSupported() ? 'Dictate' : "Voice input isn't supported in this browser"}
          >
            {listening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
          {listening && <span className="text-xs font-medium text-danger">● Listening…</span>}
          <span className="faint ml-auto hidden text-xs sm:inline">Ctrl/⌘ + Enter</span>
          <button className="btn-primary !px-3 !py-1.5" disabled={!text.trim()}>
            <Send size={14} /> Save to inbox
          </button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Views" className="flex flex-wrap gap-1 rounded-xl border border-line p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={!q && view === v.id}
              onClick={() => (setQuery(''), setView(v.id))}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-fast', !q && view === v.id ? 'bg-accent text-accent-ink' : 'muted hover:bg-raised')}
            >
              {v.label}
              <span className="ml-1.5 text-xs opacity-75">{counts[v.id]}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input className="input !py-2 pl-9" placeholder="Search all notes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search all notes" />
          {query && (
            <button className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {!q && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <p className="muted mr-auto text-sm">{viewMeta.hint}</p>
          {view === 'inbox' && counts.inbox > 0 && (
            <>
              <button className="btn-primary !py-2" onClick={() => setProcessing(true)}>
                Process inbox ({counts.inbox})
              </button>
              <AiButton loading={organize.isPending} onClick={() => organize.mutate({}, { onSuccess: (r) => setPanel({ type: 'organize', suggestions: r.result.suggestions }) })} hint="Suggest how to sort every inbox note">
                Organize
              </AiButton>
            </>
          )}
          <AiButton
            loading={summarize.isPending && !busy}
            onClick={() => summarize.mutate({ scope: 'week' }, { onSuccess: (r) => setPanel({ type: 'summary', title: 'Your week in notes', summary: r.result.summary, keyPoints: r.result.key_points }) })}
            hint="Condense the last 7 days of notes"
          >
            Summarize week
          </AiButton>
          <AiButton loading={patterns.isPending} onClick={() => patterns.mutate({}, { onSuccess: (r) => setPanel({ type: 'patterns', themes: r.result.themes }) })} hint="Spot recurring themes in the last 30 days">
            Find patterns
          </AiButton>
          {lastPanel && !panel && (
            <button className="btn-ghost" onClick={() => setPanelState(lastPanel)} title="Reopen without using another ✨ action">
              <History size={15} aria-hidden /> Last ✨ {PANEL_NAME[lastPanel.type]}
            </button>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Filter by tag">
          {tags.map((t) => (
            <button key={t} className={tag === t ? 'chip-on' : 'chip-off'} onClick={() => setTag(tag === t ? null : t)} aria-pressed={tag === t}>
              #{t}
              {tag === t && <X size={12} className="ml-1 inline" aria-label="clear filter" />}
            </button>
          ))}
        </div>
      )}

      <QueryState isLoading={notes.isLoading} error={notes.error} onRetry={() => notes.refetch()} />
      {notes.data && shown.length === 0 &&
        (q || tag ? (
          <EmptyState
            emoji="🔍"
            title="No notes match"
            action={
              <button className="btn-ghost" onClick={clearFilters}>
                Clear search and filters
              </button>
            }
          >
            {q && tag ? `Nothing matches “${query.trim()}” with #${tag}.` : q ? `Nothing matches “${query.trim()}”.` : `No notes in ${viewMeta.label} have #${tag}.`}
          </EmptyState>
        ) : view === 'inbox' && all.length > 0 ? (
          <EmptyState emoji="🌸" title="Inbox zero" className="motion-safe:animate-fade-in">
            Everything you’ve captured has a place. New thoughts land here — press <kbd className="kbd">N</kbd> any time.
          </EmptyState>
        ) : (
          <EmptyState emoji={viewMeta.empty.emoji} title={viewMeta.empty.title}>
            {viewMeta.empty.body}
          </EmptyState>
        ))}
      {q && shown.length > 0 && <p className="muted mb-3 text-sm">{shown.length} result{shown.length === 1 ? '' : 's'} across all notes</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((n) => (
          <NoteCard
            key={n.id}
            className={landed(n.id) ? 'motion-safe:animate-fade-in' : undefined}
            note={n}
            showState={!!q || view === 'all'}
            highlight={n.id === focusNote}
            links={linkText(n.id)}
            onChange={(patch) => changeNote(n, patch)}
            onDelete={() => remove(n)}
            onConvert={(kind) => setConvert({ note: n, kind, selection: selection.current?.noteId === n.id ? selection.current.text : '' })}
            onAi={(action) => runAi(n, action)}
            aiBusy={busy?.id === n.id ? busy.action : null}
            aiDisabled={aiOff}
          />
        ))}
      </div>

      {processing && (
        <ProcessInbox
          onChange={changeNote}
          onDelete={remove}
          onClose={() => {
            setProcessing(false);
            setParams((p) => (p.delete('process'), p));
          }}
        />
      )}
      {convert && <ConvertDialog note={convert.note} kind={convert.kind} selection={convert.selection} onClose={() => setConvert(null)} />}
      {panel?.type === 'organize' && <OrganizePanel suggestions={panel.suggestions} onClose={closePanel} />}
      {panel?.type === 'extract' && <ExtractPanel note={panel.note} actions={panel.actions} onClose={closePanel} />}
      {panel?.type === 'summary' && <SummaryPanel title={panel.title} summary={panel.summary} keyPoints={panel.keyPoints} onClose={closePanel} />}
      {panel?.type === 'patterns' && <PatternsPanel themes={panel.themes} onClose={closePanel} />}
      {panel?.type === 'plan' && <PlanPanel note={panel.note} plan={panel.plan} onClose={closePanel} />}
    </div>
  );
}
