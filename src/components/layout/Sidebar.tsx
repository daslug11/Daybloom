import { PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useNotes } from '../../hooks/data/notes';
import { NAV } from '../../lib/nav';
import { cn } from '../../lib/utils';
import { Logo } from './Logo';

const KEY = 'daybloom:sidebar-collapsed';

export function useInboxCount() {
  const { data } = useNotes();
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
      'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
      collapsed && 'justify-center px-0',
      isActive
        ? 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-400/30 dark:text-white'
        : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
    );

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-900/10 bg-white/50 p-3 backdrop-blur-xl transition-[width] md:flex dark:border-white/10 dark:bg-white/[0.02]',
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
            {to === '/app/brain-dump' && inbox > 0 && (
              <span
                className={cn('rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white', collapsed ? 'absolute right-2 top-1.5' : 'ml-auto')}
                aria-label={`${inbox} in inbox`}
              >
                {inbox}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-slate-900/10 pt-3 dark:border-white/10">
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
