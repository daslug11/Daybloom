import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { useSettings } from '../hooks/useData';
import { NAV } from '../lib/nav';
import type { PageId } from '../lib/types';
import { cn } from '../lib/utils';

export function Sidebar({ page }: { page: PageId }) {
  const { navigate, openSettings } = useApp();
  const [settings, setSettings] = useSettings();
  const collapsed = settings.sidebarCollapsed;

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 240 }}
      transition={{ type: 'spring', damping: 30, stiffness: 260 }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-900/10 bg-white/40 p-3 backdrop-blur-2xl md:flex dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className={cn('mb-6 flex items-center gap-2.5 px-2 pt-2', collapsed && 'justify-center px-0')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-blue-500 to-pink-500 text-xl shadow-[0_0_30px_-4px_rgba(139,92,246,0.8)]">
          🌸
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="gradient-text text-lg font-extrabold leading-none">Daybloom</div>
            <div className="muted mt-1 text-[11px]">life, but organized ✨</div>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              title={collapsed ? label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                collapsed && 'justify-center px-0',
                active
                  ? 'text-violet-700 dark:text-white'
                  : 'text-slate-500 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/20 to-blue-500/10 shadow-[0_0_24px_-6px_rgba(139,92,246,0.6)]"
                />
              )}
              <Icon size={18} className="relative shrink-0" />
              {!collapsed && <span className="relative truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-slate-900/10 pt-3 dark:border-white/10">
        <button
          onClick={openSettings}
          className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-900/5 dark:text-slate-400 dark:hover:bg-white/5', collapsed && 'justify-center px-0')}
        >
          <SettingsIcon size={18} />
          {!collapsed && 'Settings'}
        </button>
        <button
          onClick={() => setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))}
          className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-900/5 dark:text-slate-400 dark:hover:bg-white/5', collapsed && 'justify-center px-0')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </motion.aside>
  );
}
