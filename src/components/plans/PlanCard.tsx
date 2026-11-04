import { CalendarPlus, CalendarRange, Check, Pencil, Shapes, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSpaceActions, useSpaces } from '../../hooks/data/spaces';
import { normalizeDesign, templateById } from '../../lib/spaces';
import { weeksLabel, type PlanSession } from '../../../server/data/recurrence';
import { usePlanActions, usePlans } from '../../hooks/data/plans';
import { useAi } from '../../hooks/useAi';
import { useToast } from '../../hooks/useToast';
import { parseKey } from '../../lib/dates';
import { formatMinutes, weekdayShort } from '../../lib/planner';
import type { Plan } from '../../lib/types';
import { cn } from '../../lib/utils';
import { AiButton } from '../ui/Ai';
import { AddPlanDialog } from './AddPlanDialog';
import { PlanEditor } from './PlanEditor';

/** "Mon 6:00 PM · 45 min · Leg day: squats", with the day and time in the user's locale (like the Planner grid). */
function sessionText(s: Pick<PlanSession, 'day' | 'start' | 'duration' | 'title' | 'details'>) {
  return `${weekdayShort(s.day)} ${formatMinutes(s.start)} · ${s.duration} min · ${s.title}${s.details ? `: ${s.details}` : ''}`;
}

/**
 * A plan Atlas drafted: title, length and every weekly session, with
 * Add to Planner / Edit / Regenerate / Dismiss. `hud` styles it for voice mode.
 */
export function PlanCard({ planId, variant = 'chat' }: { planId: string; variant?: 'chat' | 'hud' }) {
  const { data: plans, isLoading } = usePlans();
  const plan = plans?.find((p) => p.id === planId);
  if (isLoading) return null;
  if (!plan) return <p className={cn('text-xs', variant === 'hud' ? 'text-cyan-400/80' : 'faint')}>This plan was removed.</p>;
  return <PlanCardBody plan={plan} variant={variant} />;
}

/**
 * The voice HUD is always dark and cyan, whatever the app theme, so its card uses its own
 * buttons instead of the theme-following ones.
 */
const HUD_BTN = 'btn min-h-11 !px-3 !py-1.5 text-xs shadow-none sm:min-h-9';
const HUD_PRIMARY = `${HUD_BTN} bg-cyan-300 text-cyan-950 hover:bg-cyan-200`;
const HUD_GHOST = `${HUD_BTN} border border-cyan-400/50 bg-transparent text-cyan-100 hover:bg-cyan-400/10`;
const HUD_AI = 'min-h-11 !border-cyan-400/50 !bg-cyan-400/10 !text-cyan-200 hover:!bg-cyan-400/20 sm:min-h-9';

function PlanCardBody({ plan, variant }: { plan: Plan; variant: 'chat' | 'hud' }) {
  const actions = usePlanActions();
  const regen = useAi<Plan>('regenerate_plan');
  const toast = useToast();
  const [dialog, setDialog] = useState<'edit' | 'add' | null>(null);
  const hud = variant === 'hud';
  const layer = hud ? 'z-[95]' : undefined;
  const draft = plan.status === 'draft';
  const start = plan.start_date ? parseKey(plan.start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  const run = (p: Promise<unknown>) => p.catch(() => toast('That did not work. Please try again.'));

  return (
    <section
      aria-label={`Plan: ${plan.title}`}
      className={cn(
        'min-w-0 rounded-2xl border p-3.5 text-sm',
        hud ? 'border-cyan-400/40 bg-cyan-950/40 font-mono text-cyan-50' : 'border-atlas/30 bg-surface shadow-card',
        plan.status === 'dismissed' && 'opacity-60',
      )}
    >
      <header className="flex items-start gap-2.5">
        <CalendarRange size={18} className={cn('mt-0.5 shrink-0', hud ? 'text-cyan-300' : 'text-atlas')} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="font-semibold leading-snug [overflow-wrap:anywhere]">
            {plan.title}
          </h3>
          <p className={cn('text-xs', hud ? 'text-cyan-300/80' : 'muted')}>
            {weeksLabel(plan.weeks)} · {plan.sessions.length} session{plan.sessions.length === 1 ? '' : 's'} a week{start ? ` · from ${start}` : ''}
          </p>
        </div>
        {!draft && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
              hud ? (plan.status === 'dismissed' ? 'bg-cyan-400/10 text-cyan-300' : 'bg-emerald-400/10 text-emerald-300') : plan.status === 'dismissed' ? 'bg-raised text-muted' : 'bg-success/10 text-success',
            )}
          >
            {plan.status === 'active' ? 'On your Planner' : plan.status === 'paused' ? 'Paused' : 'Dismissed'}
          </span>
        )}
      </header>
      {plan.summary && (
        <p dir="auto" className={cn('mt-2 [overflow-wrap:anywhere]', hud ? 'text-cyan-100/90' : 'muted')}>
          {plan.summary}
        </p>
      )}
      <ul className="mt-2.5 space-y-1" aria-label="Sessions">
        {plan.sessions.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', hud ? 'bg-cyan-300' : 'bg-atlas')} aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{sessionText(s)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {draft && (
          <>
            <button className={hud ? HUD_PRIMARY : 'btn-primary !px-3 !py-1.5 text-xs'} onClick={() => setDialog('add')}>
              <CalendarPlus size={14} /> Add to Planner
            </button>
            <button className={hud ? HUD_GHOST : 'btn-ghost !px-3 !py-1.5 text-xs'} onClick={() => setDialog('edit')}>
              <Pencil size={13} /> Edit
            </button>
            <AiButton size="sm" className={hud ? HUD_AI : undefined} loading={regen.isPending} onClick={() => regen.mutate({ plan_id: plan.id }, { onSuccess: () => actions.refresh() })} hint="Write a different version of this plan">
              Regenerate
            </AiButton>
            <button className={hud ? HUD_GHOST : 'btn-ghost !px-3 !py-1.5 text-xs'} onClick={() =>
                run(
                  actions.setStatus(plan, 'dismissed').then(() =>
                    toast(`Dismissed “${plan.title}”`, { label: 'Undo', onClick: () => void run(actions.setStatus(plan, 'draft')) }),
                  ),
                )
              }>
              <X size={13} /> Dismiss
            </button>
          </>
        )}
        {(plan.status === 'active' || plan.status === 'paused') && (
          <Link to="/app/planner#plans" className={cn('text-xs', hud ? 'text-cyan-300 underline' : 'link')}>
            <Check size={12} className="mr-1 inline" aria-hidden />
            See it in Planner → Plans
          </Link>
        )}
        {plan.status !== 'dismissed' && <LogSpaceButton plan={plan} className={hud ? HUD_GHOST : 'btn-ghost !px-3 !py-1.5 text-xs'} />}
        {plan.status === 'dismissed' && (
          <button className={hud ? HUD_GHOST : 'btn-ghost !px-3 !py-1.5 text-xs'} onClick={() => run(actions.setStatus(plan, 'draft'))}>
            <Undo2 size={13} /> Restore
          </button>
        )}
      </div>

      {dialog === 'edit' && <PlanEditor plan={plan} onClose={() => setDialog(null)} layer={layer} />}
      {dialog === 'add' && <AddPlanDialog plan={plan} onClose={() => setDialog(null)} layer={layer} />}
    </section>
  );
}

/**
 * "Make a log Space": a matching Space (running log, workout log or study log) to log
 * each session in, linked to the plan's habit and goal. A template, so no AI.
 */
function LogSpaceButton({ plan, className }: { plan: Plan; className: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const spaces = useSpaces();
  const { create } = useSpaceActions();
  const tag = `plan:${plan.id.replace(/-/g, '').slice(0, 32)}`;
  const existing = spaces.data?.find((s) => s.template_id === tag && s.status !== 'draft');
  if (existing) {
    return (
      <button className={className} onClick={() => navigate(`/app/spaces/${existing.id}`)}>
        <Shapes size={13} aria-hidden /> Open log
      </button>
    );
  }
  const make = async () => {
    const text = `${plan.title} ${plan.summary} ${plan.sessions.map((x) => x.title).join(' ')}`.toLowerCase();
    const kind = /\b(run|running|jog|5k|10k|marathon)\b/.test(text) ? 'running' : /\b(study|revis|exam|read|learn|homework|course|practice)\w*/.test(text) ? 'study' : 'workouts';
    const tpl = kind === 'study' ? null : templateById(kind)!;
    const design = tpl
      ? tpl.design
      : normalizeDesign({
          primary: 'session',
          fields: [
            { key: 'session', name: 'Session', type: 'text' },
            { key: 'date', name: 'Date', type: 'date', default_today: true },
            { key: 'time', name: 'Time spent', type: 'duration' },
            { key: 'topic', name: 'Topic', type: 'tags' },
            { key: 'focus', name: 'Focus', type: 'rating' },
            { key: 'notes', name: 'Notes', type: 'long_text' },
          ],
          views: [{ type: 'table', name: 'Log' }, { type: 'chart', name: 'Time', field: 'date', y: 'time', chart: 'bar', agg: 'sum' }, { type: 'calendar', name: 'Calendar', field: 'date' }],
          summaries: [{ kind: 'total', label: 'Total time', field: 'time' }, { kind: 'streak', label: 'Streak', field: 'date' }, { kind: 'count', label: 'Sessions' }],
        }).design;
    const saved = await create
      .mutateAsync({
        space: {
          name: `${plan.title} log`.slice(0, 60),
          emoji: tpl?.emoji ?? '📖',
          color: tpl?.color ?? 1,
          description: `Log each session of “${plan.title}”.`,
          design,
          template_id: tag,
          habit_id: plan.habit_id,
          goal_id: plan.goal_id,
          settings: {},
        },
      })
      .catch(() => null);
    if (saved) {
      toast(`Made “${saved.name}”. Log each session there.`, { label: 'Open', onClick: () => navigate(`/app/spaces/${saved.id}`) });
    }
  };
  return (
    <button className={className} onClick={make} disabled={create.isPending} title="A Space to log each session in (no AI)">
      <Shapes size={13} aria-hidden /> Make a log Space
    </button>
  );
}
