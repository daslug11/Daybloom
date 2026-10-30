import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHabits } from '../../hooks/data/habits';
import { useNotes } from '../../hooks/data/notes';
import { useTasks } from '../../hooks/data/tasks';
import { useAppActions } from '../../hooks/useAppActions';
import { useUserId } from '../../hooks/useAuth';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { Card, CardTitle } from '../ui/Card';

/** First-steps checklist on the dashboard. Every item is checked from real data; it disappears once done. */
export function GettingStarted() {
  const uid = useUserId();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { data: notes } = useNotes();
  const { data: tasks } = useTasks();
  const { data: habits } = useHabits();
  const { openCapture, openAtlas, startTour } = useAppActions();
  const atlas = useQuery({
    queryKey: ['atlas_count', uid],
    queryFn: async () => (await supabase.from('atlas_messages').select('id', { count: 'exact', head: true }).eq('role', 'user')).count ?? 0,
    staleTime: 60_000,
  });
  if (!profile || profile.checklist_dismissed_at || !notes || !tasks || !habits) return null;

  const items = [
    { done: notes.length > 0, label: 'Capture a thought in your Brain Dump', action: <button className="link" onClick={() => openCapture()}>Capture</button> },
    { done: tasks.length > 0, label: 'Add a task', action: <Link className="link" to="/app/tasks">Tasks</Link> },
    { done: habits.length > 0, label: 'Start a habit', action: <Link className="link" to="/app/habits">Habits</Link> },
    { done: notes.some((n) => n.processed_at), label: 'Process a note from your inbox', action: <Link className="link" to="/app/brain-dump?process=1">Process</Link> },
    { done: tasks.some((t) => t.sched_date), label: 'Block time for a task in the Planner', action: <Link className="link" to="/app/planner">Planner</Link> },
    { done: !!profile.tour_completed_at, label: 'Take the quick tour', action: <button className="link" onClick={startTour}>Start</button> },
  ];
  // Optional, so finishing the checklist never requires spending AI.
  const optional = { done: (atlas.data ?? 0) > 0, label: 'Optional: ask Atlas something (uses 1 ✨)', action: <button className="link" onClick={() => openAtlas()}>Ask</button> };
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <Card data-tour="checklist" className="lg:col-span-2">
      <CardTitle
        action={
          <button
            className="icon-btn h-8 w-8"
            onClick={() => update.mutate({ checklist_dismissed_at: new Date().toISOString() })}
            aria-label="Hide the getting started checklist (bring it back from Settings)"
            title="Hide (bring it back from Settings)"
          >
            <X size={15} />
          </button>
        }
      >
        Getting started · {done}/{items.length}
      </CardTitle>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full w-full origin-left bg-accent transition-transform duration-base ease-out" style={{ transform: `scaleX(${done / items.length})` }} />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {[...items, optional].map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', i.done ? 'border-transparent bg-success text-canvas' : 'border-control')} aria-hidden>
              {i.done && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={cn('flex-1', i.done && 'faint line-through')}>
              <span className="sr-only">{i.done ? 'Done: ' : 'To do: '}</span>
              {i.label}
            </span>
            {!i.done && <span className="text-xs">{i.action}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
