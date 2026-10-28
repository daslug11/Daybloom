import { Command, Moon, Plus, Search, Settings as SettingsIcon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { useSettings } from '../hooks/useData';
import { Modal } from './Modal';
import { QuickAddBar } from './QuickAddBar';

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function TopBar() {
  const { openPalette, openSettings } = useApp();
  const [settings, setSettings] = useSettings();
  const [mobileAdd, setMobileAdd] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const dark = settings.theme === 'dark';

  // Press "n" anywhere to jump into quick add.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      if (quickAddRef.current?.offsetParent) quickAddRef.current.focus();
      else setMobileAdd(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-900/5 bg-slate-100/60 px-4 py-3 backdrop-blur-xl sm:px-6 dark:border-white/5 dark:bg-[#07060d]/60">
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-2xl">🌸</span>
        <span className="gradient-text text-lg font-extrabold">Daybloom</span>
      </div>
      <QuickAddBar ref={quickAddRef} className="hidden max-w-xl flex-1 sm:block" />
      <button
        onClick={openPalette}
        className="ml-auto flex min-w-0 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/50 px-3 py-2 text-sm text-slate-500 transition hover:border-violet-400/40 sm:ml-0 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
        aria-label="Open command palette"
      >
        <Search size={16} className="shrink-0" />
        <span className="hidden lg:inline">Jump to…</span>
        <kbd className="hidden items-center gap-0.5 rounded-md border border-slate-900/10 px-1.5 py-0.5 text-[11px] lg:flex dark:border-white/10">
          {isMac ? <Command size={11} /> : 'Ctrl'} K
        </kbd>
      </button>
      <div className="flex items-center gap-1 sm:ml-auto">
        <button className="icon-btn sm:hidden" aria-label="Quick add" onClick={() => setMobileAdd(true)}>
          <Plus size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label="Toggle theme"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setSettings((s) => ({ ...s, theme: dark ? 'light' : 'dark' }))}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="icon-btn md:hidden" aria-label="Settings" onClick={openSettings}>
          <SettingsIcon size={18} />
        </button>
        {settings.name && (
          <div className="ml-1 hidden h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-bold text-white sm:flex">
            {settings.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <Modal open={mobileAdd} onClose={() => setMobileAdd(false)} title="Quick add ✨">
        <QuickAddBar autoFocus inlinePreview onAdded={() => setMobileAdd(false)} placeholder="gym tomorrow 6pm #health !high" />
        <p className="muted mt-3 text-xs">Dates, times, #tags, !priority and “for 45m” are detected as you type.</p>
      </Modal>
    </header>
  );
}
