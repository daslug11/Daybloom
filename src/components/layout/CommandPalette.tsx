import { Bot, CalendarPlus, ExternalLink, Inbox, ListChecks, Mic, Moon, PlayCircle, RefreshCw, Search, Settings as SettingsIcon, Timer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useCalendars } from '../../hooks/data/calendars';
import { useAppActions } from '../../hooks/useAppActions';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useTimer } from '../../hooks/useTimer';
import { NAV } from '../../lib/nav';
import { useOverlay } from '../../hooks/useOverlay';
import { cn } from '../../lib/utils';

interface Command {
  id: string;
  group: string;
  label: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { openCapture, openAtlas, openVoice, startTour } = useAppActions();
  const { data: calendars = [] } = useCalendars();
  const sync = useCalendarSync();
  const timer = useTimer();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  useOverlay({ open, onEscape: onClose, container: panel });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const q = query.trim();
    const list: Command[] = [
      ...NAV.map((n) => ({ id: `nav-${n.to}`, group: 'Go to', label: n.label, icon: <n.icon size={16} />, keywords: n.blurb, run: () => navigate(n.to) })),
      { id: 'nav-settings', group: 'Go to', label: 'Settings', icon: <SettingsIcon size={16} />, keywords: 'account password email export delete voice theme', run: () => navigate('/app/settings') },
      { id: 'capture', group: 'Actions', label: 'Capture a note', icon: <Inbox size={16} />, keywords: 'brain dump inbox new', run: () => openCapture({ mode: 'note' }) },
      { id: 'process', group: 'Actions', label: 'Process inbox', icon: <Inbox size={16} />, keywords: 'brain dump sort', run: () => navigate('/app/brain-dump?process=1') },
      { id: 'atlas', group: 'Actions', label: 'Ask Atlas', icon: <Bot size={16} />, keywords: 'assistant ai chat help', run: () => openAtlas() },
      { id: 'voice', group: 'Actions', label: 'Voice mode', icon: <Mic size={16} />, keywords: 'talk speak atlas hud', run: () => openVoice() },
      {
        id: 'timer',
        group: 'Actions',
        label: timer.running ? 'Pause focus timer' : 'Start focus timer',
        icon: <Timer size={16} />,
        keywords: 'pomodoro focus',
        run: () => (timer.running ? timer.pause() : timer.start()),
      },
      {
        id: 'theme',
        group: 'Actions',
        label: 'Switch light / dark theme',
        icon: <Moon size={16} />,
        keywords: 'appearance mode',
        run: () => update.mutate({ theme: profile?.theme === 'light' ? 'dark' : 'light' }),
      },
      { id: 'add-calendar', group: 'Calendars', label: 'Add calendar', icon: <CalendarPlus size={16} />, keywords: 'new link', run: () => navigate('/app/calendars?add=1') },
      ...(sync.syncedCalendars.length
        ? [{ id: 'sync', group: 'Calendars', label: 'Sync calendars now', icon: <RefreshCw size={16} />, keywords: 'refresh ics feed', run: () => sync.sync() }]
        : []),
      ...calendars.map((c) => ({
        id: `cal-${c.id}`,
        group: 'Calendars',
        label: `Open calendar… ${c.emoji} ${c.name}`,
        icon: <ExternalLink size={16} />,
        keywords: 'open calendar',
        run: () => window.open(c.url, '_blank', 'noopener,noreferrer'),
      })),
      { id: 'tour', group: 'Help', label: 'Replay the tour', icon: <PlayCircle size={16} />, keywords: 'help tutorial guide', run: () => startTour() },
    ];
    if (!q) return list;
    const lower = q.toLowerCase();
    const matches = list.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(lower));
    return [
      ...matches,
      { id: 'add-task', group: 'Add', label: `Add task: “${q}”`, icon: <ListChecks size={16} />, run: () => openCapture({ mode: 'task', text: q }) },
      { id: 'add-note', group: 'Add', label: `Capture note: “${q}”`, icon: <Inbox size={16} />, run: () => openCapture({ mode: 'note', text: q }) },
      { id: 'ask', group: 'Add', label: `Ask Atlas: “${q}”`, icon: <Bot size={16} />, run: () => openAtlas(q) },
    ];
  }, [query, calendars, sync, timer, profile?.theme, navigate, openCapture, openAtlas, openVoice, startTour, update]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;
  const run = (c?: Command) => {
    if (!c) return;
    onClose();
    c.run();
  };
  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Command palette" className="relative w-full max-w-xl animate-fade-in overflow-hidden rounded-card border border-line bg-overlay shadow-modal">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-ink" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, commands.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(commands[active]);
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={`palette-${active}`}
            aria-label="Type a command or search"
            placeholder="Go to a page, run an action, or type something to add…"
            className="w-full bg-transparent py-4 text-base outline-none placeholder:text-faint"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && <div className="faint px-3 pb-1 pt-3 text-xs font-medium">{header}</div>}
                <button
                  id={`palette-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm', i === active ? 'bg-ink/[0.06] text-ink' : 'text-ink ')}
                >
                  <span className="opacity-70" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="truncate">{c.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
