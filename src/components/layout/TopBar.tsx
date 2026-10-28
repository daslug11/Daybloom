import { ChevronDown, Command, LogOut, Moon, Plus, Search, Settings as SettingsIcon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppActions } from '../../hooks/useAppActions';
import { useAuth } from '../../hooks/useAuth';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { AiAllowance } from '../ui/Ai';
import { Logo } from './Logo';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar() {
  const { openCapture, openPalette } = useAppActions();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const dark = (profile?.theme ?? 'dark') === 'dark';

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-900/5 bg-slate-100/80 px-4 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-6 dark:border-white/5 dark:bg-[#08070f]/80">
      <Link to="/app" className="md:hidden" aria-label="Daybloom home">
        <Logo compact />
      </Link>
      <button
        onClick={() => openCapture()}
        className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-3 py-2 text-left text-sm text-slate-600 transition hover:border-violet-400/50 sm:flex md:max-w-md dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
        data-tour="capture"
      >
        <Plus size={16} className="shrink-0 text-violet-500" aria-hidden />
        <span className="truncate">Capture a thought or task…</span>
        <kbd className="kbd ml-auto">N</kbd>
      </button>
      <button onClick={openPalette} className="icon-btn ml-auto sm:ml-0 lg:w-auto lg:gap-2 lg:px-3" aria-label="Search and jump (command palette)">
        <Search size={17} aria-hidden />
        <span className="hidden text-sm lg:inline">Jump to</span>
        <kbd className="kbd hidden lg:inline-flex">{isMac ? <Command size={10} /> : 'Ctrl'}K</kbd>
      </button>
      <AiAllowance className="hidden sm:inline-flex" />
      <button
        className="icon-btn"
        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={() => update.mutate({ theme: dark ? 'light' : 'dark' })}
      >
        {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
      </button>
      <AccountMenu />
    </header>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const initial = (profile?.name || user?.email || '?')[0]?.toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 hover:bg-slate-900/5 dark:hover:bg-white/10" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-bold text-white">{initial}</span>
        <ChevronDown size={14} className="muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 animate-fade-in rounded-2xl border border-slate-900/10 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#15121f]">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{profile?.name || 'Your account'}</div>
            <div className="muted truncate text-xs">{user?.email}</div>
          </div>
          <AiAllowance className="mx-3 mb-2 sm:hidden" />
          <Link role="menuitem" to="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-900/5 dark:hover:bg-white/5">
            <SettingsIcon size={15} aria-hidden /> Settings
          </Link>
          <button role="menuitem" onClick={() => signOut()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-900/5 dark:hover:bg-white/5">
            <LogOut size={15} aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
