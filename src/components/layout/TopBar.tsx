import { ChevronDown, Command, LogOut, Moon, Plus, Search, Settings as SettingsIcon, Sun } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppActions } from '../../hooks/useAppActions';
import { useAuth } from '../../hooks/useAuth';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { AiAllowance } from '../ui/Ai';
import { Menu, MenuItem } from '../ui/Menu';
import { Logo } from './Logo';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar() {
  const { openCapture, openPalette } = useAppActions();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const dark = (profile?.theme ?? 'dark') === 'dark';

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5 sm:gap-3 sm:px-6">
      <Link to="/app" className="md:hidden" aria-label="Daybloom home">
        <Logo compact />
      </Link>
      <button
        onClick={() => openCapture()}
        className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-muted transition hover:border-line-strong sm:flex md:max-w-md"
        data-tour="capture"
      >
        <Plus size={16} className="shrink-0 text-ink" aria-hidden />
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
  const navigate = useNavigate();
  const initial = (profile?.name || user?.email || '?')[0]?.toUpperCase();
  return (
    <Menu
      label="Account menu"
      width={240}
      triggerClassName="flex items-center gap-1 rounded-full p-0.5 pr-1.5 hover:bg-raised"
      trigger={
        <>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-sm font-semibold text-ink ring-1 ring-line-strong">{initial}</span>
          <ChevronDown size={14} className="muted" aria-hidden />
        </>
      }
    >
      {(close) => (
        <>
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{profile?.name || 'Your account'}</div>
            <div className="muted truncate text-xs">{user?.email}</div>
          </div>
          <AiAllowance className="mx-3 mb-2 sm:hidden" />
          <MenuItem onClick={() => (close(), navigate('/app/settings'))}>
            <SettingsIcon size={15} aria-hidden /> Settings
          </MenuItem>
          <MenuItem onClick={() => (close(), void signOut())}>
            <LogOut size={15} aria-hidden /> Log out
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
