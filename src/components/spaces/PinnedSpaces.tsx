/** Spaces outside their own page: the Dashboard card and date reminders (no AI). */
import { ArrowRight, Bell, Shapes } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSpaces, useSpaceItems } from '../../hooks/data/spaces';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { computeSummary, formatDay, itemTitle, type Space, type SpaceItem } from '../../lib/spaces';
import { Card, CardTitle } from '../ui/Card';
import { SpaceIcon } from './fields';

/** Items whose reminder date is within the Space's reminder window (and not ticked off). */
export function dueReminders(space: Space, items: SpaceItem[], today: string): { item: SpaceItem; day: string; days: number }[] {
  const key = space.settings.reminder_field;
  if (!key) return [];
  const window = space.settings.reminder_days ?? 1;
  const t = Date.parse(`${today}T12:00:00Z`);
  return items
    .filter((i) => !(space.design.check && i.values[space.design.check] === true))
    .map((item) => {
      const d = item.values[key];
      if (typeof d !== 'string') return null;
      const days = Math.round((Date.parse(`${d}T12:00:00Z`) - t) / 86_400_000);
      return days >= 0 && days <= window ? { item, day: d, days } : null;
    })
    .filter((x): x is { item: SpaceItem; day: string; days: number } => !!x)
    .sort((a, b) => a.days - b.days);
}

function PinnedRow({ space }: { space: Space }) {
  const { today, tz } = useToday();
  const items = useSpaceItems(space.id);
  const first = space.design.summaries[0];
  const r = items.data && first ? computeSummary(space.design, first, items.data, today, tz) : null;
  return (
    <li>
      <Link to={`/app/spaces/${space.id}`} className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-raised">
        <SpaceIcon emoji={space.emoji} color={space.color} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{space.name}</span>
          <span className="block truncate text-xs text-muted">
            {items.isLoading ? 'Loading…' : items.error ? 'Couldn’t load' : r ? `${first.label}: ${r.display}${r.sub ? ` · ${r.sub}` : ''}` : `${items.data?.length ?? 0} items`}
          </span>
        </span>
        {r?.ratio !== undefined && (first.kind === 'progress' || first.kind === 'budget') && (
          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-ink/[0.08] sm:block" aria-hidden>
            <span className={`block h-full origin-left rounded-full ${r.over && first.kind === 'budget' ? 'bg-danger' : 'bg-ink'}`} style={{ transform: `scaleX(${r.ratio})` }} />
          </span>
        )}
      </Link>
    </li>
  );
}

function ReminderRows({ space }: { space: Space }) {
  const { today } = useToday();
  const items = useSpaceItems(space.id);
  const due = items.data ? dueReminders(space, items.data, today) : [];
  return (
    <>
      {due.slice(0, 5).map(({ item, day, days }) => (
        <li key={item.id}>
          <Link to={`/app/spaces/${space.id}`} className="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-raised">
            <span aria-hidden>{space.emoji}</span>
            <span className="min-w-0 flex-1 truncate">{itemTitle(space.design, item)}</span>
            <span className={`shrink-0 text-xs ${days === 0 ? 'font-semibold text-warning' : 'text-muted'}`}>{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </Link>
        </li>
      ))}
    </>
  );
}

/** "Pinned Spaces" on the Dashboard, plus upcoming reminders. Hidden when there's nothing to show. */
export function PinnedSpacesCard() {
  const spaces = useActiveSpaces().data ?? [];
  const pinned = spaces.filter((s) => s.settings.pinned);
  const reminding = spaces.filter((s) => s.settings.reminder_field);
  if (!pinned.length && !reminding.length) return null;
  return (
    <Card aria-label="Pinned Spaces" className="lg:col-span-2">
      <CardTitle icon={<Shapes size={16} className="text-muted" />} action={<Link to="/app/spaces" className="link text-xs">Spaces <ArrowRight size={11} className="inline" /></Link>}>
        Pinned Spaces
      </CardTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {pinned.length > 0 ? (
          <ul className="-mx-2 space-y-0.5">
            {pinned.slice(0, 6).map((s) => <PinnedRow key={s.id} space={s} />)}
          </ul>
        ) : (
          <p className="text-sm text-muted">Pin a Space from its settings to see its key number here.</p>
        )}
        {reminding.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted"><Bell size={12} aria-hidden /> Coming up</p>
            <ul className="-mx-2 space-y-0.5">
              {reminding.map((s) => <ReminderRows key={s.id} space={s} />)}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

const SEEN_KEY = 'daybloom:space-reminders-seen';

/**
 * While Daybloom is open: one in-app toast per due item per day, and a browser
 * notification too if the user allowed them. Runs in the app shell.
 */
function ReminderWatcher({ space }: { space: Space }) {
  const { today } = useToday(15 * 60_000);
  const items = useSpaceItems(space.id);
  const toast = useToast();
  useEffect(() => {
    if (!items.data) return;
    const due = dueReminders(space, items.data, today);
    if (!due.length) return;
    let seen: Record<string, string> = {};
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
    } catch {
      /* ignore */
    }
    const fresh = due.filter((d) => seen[`${d.item.id}:${d.day}`] !== today);
    if (!fresh.length) return;
    for (const d of fresh) seen[`${d.item.id}:${d.day}`] = today;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(Object.entries(seen).slice(-300))));
    } catch {
      /* ignore */
    }
    const first = fresh[0];
    const when = first.days === 0 ? 'today' : first.days === 1 ? 'tomorrow' : `in ${first.days} days`;
    const text = `${space.emoji} ${itemTitle(space.design, first.item)} — ${when}${fresh.length > 1 ? ` (+${fresh.length - 1} more in ${space.name})` : ''}`;
    toast(text);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        new Notification(space.name, { body: text, tag: `space-${space.id}-${today}` });
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    }
  }, [items.data, today, space, toast]);
  return null;
}

export function SpaceReminders() {
  const spaces = useActiveSpaces().data ?? [];
  return (
    <>
      {spaces.filter((s) => s.settings.reminder_field).map((s) => (
        <ReminderWatcher key={s.id} space={s} />
      ))}
    </>
  );
}
