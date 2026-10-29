import { MoreHorizontal, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV } from '../../lib/nav';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { useInboxCount } from './Sidebar';

/** Bottom tab bar on phones: the four main pages plus "More". */
export function MobileNav() {
  const [more, setMore] = useState(false);
  const inbox = useInboxCount();
  const { pathname } = useLocation();
  const secondary = NAV.filter((n) => !n.primary);
  const inMore = secondary.some((n) => pathname.startsWith(n.to)) || pathname.startsWith('/app/settings');

  const tab = ({ isActive }: { isActive: boolean }) =>
    cn('relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium', isActive ? 'text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-400');

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-900/10 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#0b0a14]/90" aria-label="Main navigation">
        <div className="flex">
          {NAV.filter((n) => n.primary).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/app'} className={tab}>
              <Icon size={20} aria-hidden />
              <span className="max-w-full truncate">{label === 'Dashboard' ? 'Today' : label}</span>
              {to === '/app/brain-dump' && inbox > 0 && <span className="absolute right-[22%] top-1 rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">{inbox}</span>}
            </NavLink>
          ))}
          <button className={tab({ isActive: inMore })} onClick={() => setMore(true)} aria-haspopup="dialog">
            <MoreHorizontal size={20} aria-hidden />
            More
          </button>
        </div>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More">
        <div className="grid grid-cols-2 gap-2">
          {[...secondary, { to: '/app/settings', label: 'Settings', icon: SettingsIcon, blurb: 'Account, appearance, voice and data.' }].map(({ to, label, icon: Icon, blurb }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMore(false)}
              className={({ isActive }) =>
                cn('rounded-2xl border p-3 text-left transition', isActive ? 'border-violet-400/50 bg-violet-500/10' : 'border-slate-900/10 dark:border-white/10')
              }
            >
              <Icon size={18} className="text-violet-600 dark:text-violet-300" aria-hidden />
              <div className="mt-1.5 text-sm font-semibold">{label}</div>
              <div className="muted mt-0.5 text-xs leading-snug">{blurb}</div>
            </NavLink>
          ))}
        </div>
      </Modal>
    </>
  );
}
