import { Brain } from 'lucide-react';
import { Card, CardTitle } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { TimerDisplay } from '../components/TimerDisplay';
import { useFocusSessions, useSettings } from '../hooks/useData';
import { useTimer } from '../hooks/useTimer';
import { dateKey, daysAgo } from '../lib/dates';
import { clamp, cn } from '../lib/utils';

const PRESETS = [
  { label: 'Classic', work: 25, rest: 5 },
  { label: 'Long haul', work: 50, rest: 10 },
  { label: 'Sprint', work: 15, rest: 3 },
];

export default function Focus() {
  const [settings, setSettings] = useSettings();
  const [sessions] = useFocusSessions();
  const timer = useTimer();
  const { work, rest } = settings.pomodoro;

  const setPomodoro = (p: Partial<typeof settings.pomodoro>) =>
    setSettings((s) => ({ ...s, pomodoro: { ...s.pomodoro, ...p } }));

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), n: sessions[dateKey(d)] ?? 0 };
  });
  const max = Math.max(4, ...week.map((w) => w.n));

  return (
    <div>
      <PageHeader title="Focus" subtitle="One thing at a time. Phone in another room. 📵" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center py-10 lg:col-span-2">
          <TimerDisplay />
          <button
            onClick={() => timer.setDeepWork(true)}
            className="mt-8 flex items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-500/10 px-5 py-3 text-sm font-semibold transition hover:bg-violet-500/20"
          >
            <span
              className={cn(
                'relative h-6 w-11 rounded-full transition',
                timer.deepWork ? 'bg-violet-500' : 'bg-slate-900/20 dark:bg-white/20',
              )}
            >
              <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', timer.deepWork ? 'left-6' : 'left-1')} />
            </span>
            Deep Work Mode 🧠
          </button>
        </Card>

        <div className="flex flex-col gap-4">
          <Card delay={0.1}>
            <CardTitle icon={<Brain size={16} className="text-violet-400" />}>Customize</CardTitle>
            <div className="mb-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  disabled={timer.running}
                  onClick={() => setPomodoro({ work: p.work, rest: p.rest })}
                  className={work === p.work && rest === p.rest ? 'chip-on' : 'chip-off'}
                >
                  {p.label} · {p.work}/{p.rest}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">Focus (min)</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  disabled={timer.running}
                  className="input"
                  value={work}
                  onChange={(e) => setPomodoro({ work: clamp(Number(e.target.value) || 1, 1, 180) })}
                />
              </label>
              <label>
                <span className="label">Break (min)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  disabled={timer.running}
                  className="input"
                  value={rest}
                  onChange={(e) => setPomodoro({ rest: clamp(Number(e.target.value) || 1, 1, 60) })}
                />
              </label>
            </div>
            {timer.running && <p className="muted mt-2 text-xs">Pause the timer to change durations.</p>}
          </Card>

          <Card delay={0.2}>
            <CardTitle>🍅 Sessions this week</CardTitle>
            <div className="flex h-28 items-end justify-between gap-2">
              {week.map((w, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="muted text-[10px]">{w.n || ''}</span>
                  <div
                    className="w-full rounded-lg bg-gradient-to-t from-violet-600 to-blue-400 transition-all"
                    style={{ height: `${Math.max(4, (w.n / max) * 72)}px`, opacity: w.n ? 1 : 0.2 }}
                  />
                  <span className="muted text-[11px]">{w.label}</span>
                </div>
              ))}
            </div>
            <p className="muted mt-3 text-xs">Today: {sessions[dateKey()] ?? 0} completed focus session(s).</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
