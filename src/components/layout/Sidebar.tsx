import { PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useNotes } from '../../hooks/data/notes';
import { NAV } from '../../lib/nav';
import { cn } from '../../lib/utils';
import { Logo } from './Logo';

const KEY = 'daybloom:sidebar-collapsed';

/** Notes waiting in the inbox; `null` when they couldn't be loaded (shown as '—', never as 0). */
export function useInboxCount() {
  const { data, isError } = useNotes();
  if (isError && !data) return null;
  return data?.filter((n) => n.state === 'inbox').length ?? 0;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const inbox = useInboxCount();
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-fast',
      collapsed && 'justify-center px-0',
      isActive
        ? 'bg-ink/[0.06] text-ink ring-1 ring-ink/40'
        : 'text-muted hover:bg-raised hover:text-ink',
    );

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface p-3 md:flex',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
      aria-label="Main navigation"
    >
      <div className={cn('mb-5 px-2 pt-1', collapsed && 'px-0 text-center')}>
        <Logo compact={collapsed} />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" data-tour="nav">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/app'} className={linkClass} title={collapsed ? label : undefined} data-tour={`nav-${to.split('/').pop()}`}>
            <Icon size={18} className="shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{label}</span>}
            {to === '/app/brain-dump' && inbox !== 0 && (
              <span className={cn('badge', collapsed ? 'absolute right-1.5 top-1' : 'ml-auto')} title={inbox === null ? 'Inbox count couldn’t be loaded' : undefined}>
                <span aria-hidden>{inbox ?? '—'}</span>
                <span className="sr-only">{inbox === null ? ', inbox count unavailable' : `, ${inbox} in inbox`}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-line pt-3">
        <NavLink to="/app/settings" className={linkClass} title={collapsed ? 'Settings' : undefined}>
          <SettingsIcon size={18} aria-hidden />
          {!collapsed && 'Settings'}
        </NavLink>
        <button onClick={toggle} className={linkClass({ isActive: false })} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
