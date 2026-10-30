import { MoreHorizontal, Plus, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV } from '../../lib/nav';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { useInboxCount } from './Sidebar';

/** Bottom tab bar on phones: two pages, Capture in the middle, two pages, then "More". */
export function MobileNav({ onCapture }: { onCapture: () => void }) {
  const [more, setMore] = useState(false);
  const inbox = useInboxCount();
  const { pathname } = useLocation();
  const secondary = NAV.filter((n) => !n.primary);
  const inMore = secondary.some((n) => pathname.startsWith(n.to)) || pathname.startsWith('/app/settings');

  const tab = ({ isActive }: { isActive: boolean }) =>
    cn('relative flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 text-xs font-medium tracking-[-0.01em]', isActive ? 'text-ink' : 'text-muted');

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main navigation">
        <div className="flex">
          {NAV.filter((n) => n.primary).map(({ to, label, icon: Icon }, i) => [
            i === 2 && (
              // Capture lives in the thumb zone instead of floating over content.
              <div key="capture" className="flex w-14 shrink-0 items-center justify-center">
                <button
                  onClick={onCapture}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-button transition-transform duration-press ease-out motion-safe:active:scale-[0.94]"
                  aria-label="Capture"
                  title="Capture a note or task"
                  data-tour="capture"
                >
                  <Plus size={22} aria-hidden />
                </button>
              </div>
            ),
            <NavLink key={to} to={to} end={to === '/app'} className={(s) => cn(tab(s), to === '/app/brain-dump' && 'flex-[1.4]')} data-tour={`nav-${to.split('/').pop()}`}>
              <Icon size={20} aria-hidden />
              <span className="max-w-full whitespace-nowrap">{label === 'Dashboard' ? 'Today' : label}</span>
              {to === '/app/brain-dump' && inbox !== 0 && (
                <span className="badge absolute right-[18%] top-0.5">
                  <span aria-hidden>{inbox ?? '—'}</span>
                  <span className="sr-only">{inbox === null ? ', inbox count unavailable' : `, ${inbox} in inbox`}</span>
                </span>
              )}
            </NavLink>,
          ])}
          <button className={tab({ isActive: inMore })} onClick={() => setMore(true)} aria-haspopup="dialog" data-tour="nav-habits">
            <MoreHorizontal size={20} aria-hidden />
            More
          </button>
        </div>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More" variant="sheet">
        <div className="grid grid-cols-2 gap-2">
          {[...secondary, { to: '/app/settings', label: 'Settings', icon: SettingsIcon, blurb: 'Account, appearance, voice and data.' }].map(({ to, label, icon: Icon, blurb }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMore(false)}
              className={({ isActive }) =>
                cn('rounded-2xl border p-3 text-left transition-colors duration-fast', isActive ? 'border-ink/40 bg-ink/[0.06]' : 'border-line ')
              }
            >
              <Icon size={18} className="text-ink " aria-hidden />
              <div className="mt-1.5 text-sm font-semibold">{label}</div>
              <div className="muted mt-0.5 text-xs leading-snug">{blurb}</div>
            </NavLink>
          ))}
        </div>
      </Modal>
    </>
  );
}
