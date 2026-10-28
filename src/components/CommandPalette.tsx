import { AnimatePresence, motion } from 'framer-motion';
import { CalendarPlus, ExternalLink, Moon, Plus, Search, Settings as SettingsIcon, Timer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../hooks/useApp';
import { useCalendars, useSettings, useTasks } from '../hooks/useData';
import { useTimer } from '../hooks/useTimer';
import { useToast } from '../hooks/useToast';
import { NAV } from '../lib/nav';
import { cn, uid } from '../lib/utils';

interface Command {
  id: string;
  group: string;
  label: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate, openSettings, requestAddCalendar } = useApp();
  const [, setTasks] = useTasks();
  const [calendars] = useCalendars();
  const [, setSettings] = useSettings();
  const timer = useTimer();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Clear on close, so a reopened palette never flashes (or appends to) the old query.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const q = query.trim();
    const list: Command[] = [];
    const quickAdd: Command = {
      id: 'add-task',
      group: 'Quick add',
      label: `Add task: “${q}”`,
      icon: <Plus size={16} />,
      run: () => {
        setTasks((t) => [{ id: uid(), title: q, status: 'todo', createdAt: new Date().toISOString() }, ...t]);
        toast('Task added ✅');
      },
    };

    NAV.forEach((n) =>
      list.push({
        id: `nav-${n.id}`,
        group: 'Jump to',
        label: `${n.emoji}  ${n.label}`,
        icon: <n.icon size={16} />,
        keywords: n.id,
        run: () => navigate(n.id),
      }),
    );
    list.push({
      id: 'add-calendar',
      group: 'Calendars',
      label: '➕  Add calendar',
      icon: <CalendarPlus size={16} />,
      keywords: 'new link',
      run: () => {
        navigate('calendars');
        requestAddCalendar();
      },
    });
    calendars.forEach((c) =>
      list.push({
        id: `cal-${c.id}`,
        group: 'Calendars',
        label: `Open calendar… ${c.emoji} ${c.name}`,
        icon: <ExternalLink size={16} />,
        keywords: 'open calendar',
        run: () => window.open(c.url, '_blank', 'noopener,noreferrer'),
      }),
    );
    list.push(
      {
        id: 'timer',
        group: 'Actions',
        label: timer.running ? '⏸️  Pause focus timer' : '▶️  Start focus timer',
        icon: <Timer size={16} />,
        keywords: 'pomodoro',
        run: () => (timer.running ? timer.pause() : timer.start()),
      },
      {
        id: 'theme',
        group: 'Actions',
        label: '🌗  Toggle light / dark',
        icon: <Moon size={16} />,
        keywords: 'theme mode',
        run: () => setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
      },
      {
        id: 'settings',
        group: 'Actions',
        label: '⚙️  Settings',
        icon: <SettingsIcon size={16} />,
        keywords: 'reset export import name',
        run: openSettings,
      },
    );
    if (!q) return list;
    const lower = q.toLowerCase();
    const matches = list.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(lower));
    // Quick-add goes after real matches, so "add calendar" + Enter runs the command, not a new task.
    return [...matches, quickAdd];
  }, [query, calendars, timer, navigate, openSettings, requestAddCalendar, setTasks, setSettings, toast]);

  useEffect(() => {
    setActive(0);
  }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (c?: Command) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(commands[active]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup = '';
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-900/10 bg-white/90 shadow-[0_0_80px_-20px_rgba(139,92,246,0.7)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#12101f]/90"
          >
            <div className="flex items-center gap-3 border-b border-slate-900/10 px-4 dark:border-white/10">
              <Search size={18} className="text-violet-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a command, or a task to quick-add…"
                className="w-full bg-transparent py-4 text-base outline-none placeholder:text-slate-400"
              />
              <kbd className="muted rounded-md border border-slate-900/10 px-1.5 py-0.5 text-[10px] dark:border-white/10">ESC</kbd>
            </div>
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
              {commands.length === 0 && <p className="muted p-6 text-center text-sm">No matches 🤷</p>}
              {commands.map((c, i) => {
                const header = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                return (
                  <div key={c.id}>
                    {header && <div className="muted px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider">{header}</div>}
                    <button
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(c)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                        i === active ? 'bg-gradient-to-r from-violet-500/20 to-blue-500/10 text-violet-700 dark:text-white' : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      <span className="opacity-70">{c.icon}</span>
                      <span className="truncate">{c.label}</span>
                      {i === active && <span className="muted ml-auto text-xs">↵</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
