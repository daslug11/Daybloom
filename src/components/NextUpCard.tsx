import { AlertTriangle, ArrowRight, CalendarClock, Lock, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { useCalendars, useTasks } from '../hooks/useData';
import { useNow } from '../hooks/useNow';
import { CALENDAR_COLORS, gradient } from '../lib/calendars';
import { dateKey, parseKey } from '../lib/dates';
import { allDayEventsOn } from '../lib/planner';
import { cn } from '../lib/utils';
import { Card, CardTitle } from './Card';

interface UpItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  kind: 'event' | 'task';
  color: number;
  emoji?: string;
  location?: string;
}

function relative(start: Date, end: Date, now: Date) {
  if (start <= now && end > now) return 'Now';
  const mins = Math.round((start.getTime() - now.getTime()) / 60000);
  if (mins < 60) return `in ${mins} min`;
  if (dateKey(start) === dateKey(now)) return `in ${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}`.trim();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey(start) === dateKey(tomorrow)) return 'Tomorrow';
  return start.toLocaleDateString(undefined, { weekday: 'short' });
}

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Dashboard bento card: the next few synced events and time-blocked tasks. */
export function NextUpCard({ delay = 0, className }: { delay?: number; className?: string }) {
  const { events, syncing, requestError, errorCount, syncedCalendars, statuses } = useCalendarSync();
  const [calendars] = useCalendars();
  const [tasks] = useTasks();
  const { navigate } = useApp();
  const now = useNow(30_000);

  const items = useMemo(() => {
    const calById = new Map(calendars.map((c) => [c.id, c]));
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 3);
    const list: UpItem[] = [];
    for (const e of events) {
      if (e.allDay) continue;
      const start = new Date(e.start);
      const end = new Date(e.end);
      if (end <= now || start > horizon) continue;
      const cal = calById.get(e.calendarId);
      list.push({ id: e.id, title: e.title, start, end, kind: 'event', color: cal?.color ?? 1, emoji: cal?.emoji, location: e.location });
    }
    for (const t of tasks) {
      if (!t.schedule || t.status === 'done') continue;
      const start = parseKey(t.schedule.date);
      start.setHours(0, t.schedule.start, 0, 0);
      const end = new Date(start.getTime() + t.schedule.duration * 60000);
      if (end <= now || start > horizon) continue;
      list.push({ id: t.id, title: t.title, start, end, kind: 'task', color: 0, emoji: '✅' });
    }
    return list.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 4);
  }, [events, tasks, calendars, now]);

  const allDayToday = allDayEventsOn(events, dateKey(now));
  const failed = syncedCalendars.filter((c) => statuses[c.id]?.state === 'error');
  const loading = syncing && events.length === 0 && syncedCalendars.length > 0;

  return (
    <Card delay={delay} className={className}>
      <CardTitle
        icon={<CalendarClock size={16} className="text-cyan-500 dark:text-cyan-300" />}
        action={
          <button onClick={() => navigate('planner')} className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:underline dark:text-violet-300">
            Planner <ArrowRight size={12} />
          </button>
        }
      >
        ⏭️ Next up
      </CardTitle>

      {(requestError || errorCount > 0) && (
        <button
          onClick={() => navigate('calendars')}
          className="mb-3 flex w-full items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-left text-xs text-rose-700 dark:text-rose-200"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {requestError ?? `Couldn't sync ${failed.map((c) => `${c.emoji} ${c.name}`).join(', ')}.`} <span className="font-semibold underline">Fix it →</span>
          </span>
        </button>
      )}

      {allDayToday.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {allDayToday.map((e) => (
            <span key={e.id} className="chip-off !py-0.5">🗓️ {e.title}</span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-900/5 dark:bg-white/5" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
          <p className="muted text-center text-xs">Syncing your calendars… 🔄</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-3 text-center">
          <div className="text-3xl">🌤️</div>
          {syncedCalendars.length === 0 ? (
            <>
              <p className="mt-1 text-sm font-medium">Nothing here yet — let's change that! 🚀</p>
              <button className="mt-2 text-xs font-semibold text-violet-500 hover:underline dark:text-violet-300" onClick={() => navigate('calendars')}>
                Connect a calendar feed →
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm font-medium">Clear skies for the next few days ✨</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const rel = relative(item.start, item.end, now);
            const c = CALENDAR_COLORS[item.color] ?? CALENDAR_COLORS[0];
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2',
                  i === 0 ? 'border-violet-400/40 bg-violet-500/10' : 'border-slate-900/5 bg-white/40 dark:border-white/5 dark:bg-white/[0.03]',
                )}
              >
                <span
                  className={cn('h-9 w-1.5 shrink-0 rounded-full', item.kind === 'event' && 'striped')}
                  style={item.kind === 'event' ? ({ '--stripe': c.from } as React.CSSProperties) : { background: gradient(0, '180deg') }}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold">
                    {item.kind === 'event' && <Lock size={11} className="muted shrink-0" />}
                    <span className="truncate">{item.title}</span>
                  </p>
                  <p className="muted truncate text-xs">
                    {time(item.start)} – {time(item.end)}
                    {item.location && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        · <MapPin size={10} /> {item.location}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                    rel === 'Now' ? 'animate-pulse bg-pink-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.7)]' : 'bg-slate-900/5 dark:bg-white/10',
                  )}
                >
                  {rel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
