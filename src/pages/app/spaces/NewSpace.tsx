import { ArrowLeft, Check, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PreviewEditor, type DraftSpace } from '../../../components/spaces/PreviewEditor';
import { SpaceIcon } from '../../../components/spaces/fields';
import { AiButton } from '../../../components/ui/Ai';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ErrorState, Spinner } from '../../../components/ui/States';
import { useSpaceActions, useSpaces, useSpaceTemplates } from '../../../hooks/data/spaces';
import { useAi } from '../../../hooks/useAi';
import { useToday } from '../../../hooks/useProfile';
import { useToast } from '../../../hooks/useToast';
import { blankDesign, LIMITS, normalizeDesign, slugKey, TEMPLATES, type ItemValues, type SpaceDesign } from '../../../lib/spaces';
import { cn } from '../../../lib/utils';

interface DesignResult {
  name: string;
  emoji: string;
  color: number;
  description: string;
  design: SpaceDesign;
  samples: ItemValues[];
  follow_up: { question: string; kind: 'budget' | 'target'; amount: number | null } | null;
  dropped: string[];
}

const EXAMPLES = ['A Christmas list with a budget per person', 'A running log with pace', 'College applications with deadlines', 'Books I want to read this year'];

/** Answering the follow-up applies a fixed change locally (no second AI call). */
function applyFollowUp(design: SpaceDesign, kind: 'budget' | 'target', amount: number): SpaceDesign {
  const fields = [...design.fields];
  let money = fields.find((f) => f.type === 'money');
  if (kind === 'budget' && !money && fields.length < LIMITS.fields) {
    money = { key: 'price', name: 'Price', type: 'money', currency: 'USD', private: true };
    fields.push(money);
  }
  const person = fields.find((f) => f.type === 'person');
  const summaries = design.summaries.filter((s) => s.kind !== (kind === 'budget' ? 'budget' : 'progress'));
  if (kind === 'budget' && money) summaries.unshift({ id: 'budget', kind: 'budget', label: 'Budget', field: money.key, target: amount, group: person?.key });
  if (kind === 'target') summaries.unshift({ id: 'progress', kind: 'progress', label: 'Progress', target: amount });
  return normalizeDesign({ ...design, fields, summaries: summaries.slice(0, LIMITS.summaries) }, design).design;
}

export default function NewSpace() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { today } = useToday();
  const spaces = useSpaces();
  const templates = useSpaceTemplates();
  const { create, update, remove } = useSpaceActions();
  const designer = useAi<DesignResult>('space_design');
  const [request, setRequest] = useState(params.get('describe') ?? '');
  const [draft, setDraft] = useState<DraftSpace | null>(null);
  const [meta, setMeta] = useState<{ template_id?: string; request?: string; follow_up?: DesignResult['follow_up']; dropped?: string[] }>({});
  const [answer, setAnswer] = useState('');
  const draftId = params.get('draft');
  const atlasDraft = draftId ? spaces.data?.find((s) => s.id === draftId && s.status === 'draft') : undefined;
  const activeCount = spaces.data?.filter((s) => s.status === 'active').length ?? 0;
  const full = activeCount >= LIMITS.activeSpaces;

  // A Space drafted by Atlas opens straight into its preview.
  useEffect(() => {
    if (atlasDraft && !draft) {
      setDraft({ name: atlasDraft.name, emoji: atlasDraft.emoji, color: atlasDraft.color, description: atlasDraft.description, design: normalizeDesign(atlasDraft.design).design, samples: atlasDraft.settings.samples ?? [] });
      setMeta({ request: atlasDraft.request, dropped: (atlasDraft.settings as { dropped?: string[] }).dropped });
    }
  }, [atlasDraft, draft]);

  // ?template=running opens that template's preview.
  useEffect(() => {
    const t = params.get('template');
    const tpl = t ? TEMPLATES.find((x) => x.id === t) : undefined;
    if (tpl && !draft) {
      setDraft({ name: tpl.name, emoji: tpl.emoji, color: tpl.color, description: tpl.description, design: tpl.design, samples: tpl.samples(today) });
      setMeta({ template_id: tpl.id });
    }
  }, [params, draft, today]);

  const startTemplate = (id: string) => {
    const tpl = TEMPLATES.find((x) => x.id === id)!;
    setDraft({ name: tpl.name, emoji: tpl.emoji, color: tpl.color, description: tpl.description, design: tpl.design, samples: tpl.samples(today) });
    setMeta({ template_id: tpl.id });
  };

  const design = async () => {
    const res = await designer.mutateAsync({ request: request.trim() }).catch(() => null);
    if (!res) return;
    const r = res.result;
    setDraft({ name: r.name, emoji: r.emoji, color: r.color, description: r.description, design: r.design, samples: r.samples });
    setMeta({ request: request.trim(), follow_up: r.follow_up, dropped: r.dropped });
    setAnswer(r.follow_up?.amount ? String(r.follow_up.amount) : '');
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim() || 'Untitled Space';
    if (atlasDraft) {
      const saved = await update.mutateAsync({ id: atlasDraft.id, patch: { name, emoji: draft.emoji, color: draft.color, description: draft.description, design: draft.design, status: 'active', settings: {} } }).catch(() => null);
      if (saved) navigate(`/app/spaces/${saved.id}`, { replace: true });
      return;
    }
    const saved = await create
      .mutateAsync({ space: { name, emoji: draft.emoji, color: draft.color, description: draft.description, design: draft.design, request: meta.request ?? '', template_id: meta.template_id ?? null, settings: {} } })
      .catch(() => null);
    if (saved) {
      toast(`${draft.emoji} ${name} is ready. Add your first item.`);
      navigate(`/app/spaces/${saved.id}`, { replace: true });
    }
  };

  const discard = async () => {
    if (atlasDraft) await remove.mutateAsync(atlasDraft.id).catch(() => null);
    setDraft(null);
    setMeta({});
    if (draftId || params.get('template')) setParams({}, { replace: true });
  };

  const fu = meta.follow_up;
  const answerFollowUp = (yes: boolean) => {
    if (!draft || !fu) return;
    if (yes) {
      const n = Number(answer.replace(/[^0-9.]/g, ''));
      if (!n || n <= 0) return toast(fu.kind === 'budget' ? 'Enter a budget amount first.' : 'Enter a target first.');
      setDraft({ ...draft, design: applyFollowUp(draft.design, fu.kind, n) });
    }
    setMeta({ ...meta, follow_up: null });
  };

  const yours = useMemo(() => templates.data ?? [], [templates.data]);

  if (draftId && spaces.isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (draftId && !spaces.isLoading && !atlasDraft && !draft) {
    return <ErrorState message="That preview was already saved or discarded." onRetry={() => navigate('/app/spaces')} />;
  }

  if (draft) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={discard}>
            {atlasDraft ? <Trash2 size={15} aria-hidden /> : <ArrowLeft size={15} aria-hidden />}
            {atlasDraft ? 'Discard' : 'Start over'}
          </button>
          <div className="flex items-center gap-3">
            {full && <span className="text-xs text-danger">You have {LIMITS.activeSpaces} active Spaces. Archive one to save this.</span>}
            <button type="button" className="btn-primary" onClick={save} disabled={full || create.isPending || update.isPending}>
              <Check size={15} aria-hidden /> Save Space
            </button>
          </div>
        </div>
        {fu && (
          <div className="card mb-5 flex flex-wrap items-center gap-3 border-atlas/40 p-4" role="group" aria-label="Atlas question">
            <p className="min-w-0 flex-1 text-sm font-medium">✨ {fu.question}</p>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">{fu.kind === 'budget' ? 'Budget' : 'Target'}</span>
              {fu.kind === 'budget' && <span className="text-muted">$</span>}
              <input className="input !w-28 !py-1.5 tabular-nums" inputMode="decimal" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={fu.kind === 'budget' ? '500' : '12'} />
            </label>
            <button type="button" className="btn-primary !min-h-9" onClick={() => answerFollowUp(true)}>{fu.kind === 'budget' ? 'Add budget' : 'Add target'}</button>
            <button type="button" className="btn-ghost !min-h-9" onClick={() => answerFollowUp(false)}>No thanks</button>
          </div>
        )}
        {!!meta.dropped?.length && <p className="mb-4 text-xs text-muted">Left out because Spaces don’t support them: {meta.dropped.join('; ')}.</p>}
        <PreviewEditor draft={draft} onChange={setDraft} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New Space" description="Describe what you want to keep track of, or start from a template. You’ll see a preview with sample items before anything is saved." />
      {full && <p className="card mb-5 border-danger/30 p-4 text-sm text-danger">You have {LIMITS.activeSpaces} active Spaces, the most allowed. Archive one to make a new one.</p>}
      <section className="card mb-6 p-4 sm:p-5" aria-labelledby="describe-h">
        <h2 id="describe-h" className="text-sm font-semibold">Describe it</h2>
        <p className="muted mt-0.5 text-sm">In your own words. Atlas designs it from Daybloom’s building blocks: fields, views and summary cards.</p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (request.trim()) void design();
          }}
        >
          <label htmlFor="describe" className="sr-only">What do you want to track?</label>
          <input id="describe" className="input flex-1" value={request} maxLength={500} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. a Christmas list with a budget for each person" />
          <AiButton onClick={() => request.trim() && void design()} loading={designer.isPending} disabled={!request.trim() || full} hint="Design a Space">
            Design it
          </AiButton>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip-off" onClick={() => setRequest(ex)}>{ex}</button>
          ))}
        </div>
      </section>

      <section aria-labelledby="templates-h">
        <div className="mb-3 flex items-center gap-2">
          <LayoutTemplate size={16} className="text-muted" aria-hidden />
          <h2 id="templates-h" className="text-sm font-semibold">Start from a template</h2>
          <span className="text-xs text-muted">· no AI needed</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button type="button" disabled={full} onClick={() => { setDraft({ name: '', emoji: '✨', color: 6, description: '', design: blankDesign(), samples: [] }); setMeta({}); }} className="card card-hover flex items-start gap-3 p-4 text-left disabled:opacity-50">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-dashed border-line-strong text-muted"><Plus size={18} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Blank Space</span>
              <span className="muted mt-0.5 block text-xs leading-snug">A simple checklist you shape yourself.</span>
            </span>
          </button>
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" disabled={full} onClick={() => startTemplate(t.id)} className="card card-hover flex items-start gap-3 p-4 text-left transition-transform duration-press ease-out active:scale-[0.99] disabled:opacity-50">
              <SpaceIcon emoji={t.emoji} color={t.color} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t.name}</span>
                <span className="muted mt-0.5 block text-xs leading-snug">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {yours.length > 0 && (
        <section aria-labelledby="yours-h" className="mt-8">
          <h2 id="yours-h" className="mb-3 text-sm font-semibold">Your templates</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {yours.map((t) => (
              <button key={t.id} type="button" disabled={full} onClick={() => { setDraft({ name: t.name, emoji: t.emoji, color: t.color, description: t.description, design: normalizeDesign(t.design).design, samples: [] }); setMeta({ template_id: `own:${slugKey(t.name)}` }); }} className={cn('card card-hover flex items-start gap-3 p-4 text-left disabled:opacity-50')}>
                <SpaceIcon emoji={t.emoji} color={t.color} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{t.name}</span>
                  <span className="muted mt-0.5 block text-xs">{t.design.fields.length} fields · {t.design.views.map((v) => v.name).join(', ')}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
