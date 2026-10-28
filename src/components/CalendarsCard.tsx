import { ArrowRight, CalendarDays } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { useCalendars } from '../hooks/useData';
import { gradient } from '../lib/calendars';
import { Card, CardTitle } from './Card';

export function CalendarsCard({ delay = 0, className }: { delay?: number; className?: string }) {
  const [calendars] = useCalendars();
  const { navigate } = useApp();
  const pinned = calendars.filter((c) => c.pinned);

  return (
    <Card delay={delay} className={className}>
      <CardTitle
        icon={<CalendarDays size={16} className="text-sky-400" />}
        action={
          <button onClick={() => navigate('calendars')} className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:underline dark:text-violet-300">
            Manage <ArrowRight size={12} />
          </button>
        }
      >
        📅 My Calendars
      </CardTitle>
      {pinned.length === 0 ? (
        <p className="muted text-sm">
          {calendars.length ? 'Pin a calendar with ⭐ to get a quick-launch chip here.' : "Nothing here yet — let's change that! 🚀"}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {pinned.map((c) => (
            <a
              key={c.id}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-slate-900/10 bg-white/50 py-1.5 pl-1.5 pr-3 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm" style={{ background: gradient(c.color) }}>
                {c.emoji}
              </span>
              {c.name}
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
