import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { DeepWorkOverlay } from './components/DeepWorkOverlay';
import { GradientBlobs } from './components/GradientBlobs';
import { MobileNav } from './components/MobileNav';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WelcomeModal } from './components/WelcomeModal';
import { AppContext, type AppActions } from './hooks/useApp';
import { useSettings } from './hooks/useData';
import { useRoute } from './hooks/useRoute';
import { TimerProvider } from './hooks/useTimer';
import { ToastProvider } from './hooks/useToast';
import type { PageId } from './lib/types';
import Calendars from './pages/Calendars';
import Dashboard from './pages/Dashboard';
import Focus from './pages/Focus';
import Goals from './pages/Goals';
import Habits from './pages/Habits';
import Notes from './pages/Notes';
import Tasks from './pages/Tasks';
import WeeklyReview from './pages/WeeklyReview';

const PAGES: Record<PageId, () => JSX.Element> = {
  dashboard: Dashboard,
  tasks: Tasks,
  habits: Habits,
  focus: Focus,
  goals: Goals,
  notes: Notes,
  calendars: Calendars,
  review: WeeklyReview,
};

export default function App() {
  const { page, navigate } = useRoute();
  const [settings] = useSettings();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addCalendarRequested, setAddCalendarRequested] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const requestAddCalendar = useCallback(() => setAddCalendarRequested((n) => n + 1), []);

  const actions = useMemo<AppActions>(
    () => ({ navigate, openPalette, openSettings, requestAddCalendar, addCalendarRequested }),
    [navigate, openPalette, openSettings, requestAddCalendar, addCalendarRequested],
  );

  const Page = PAGES[page];

  return (
    <AppContext.Provider value={actions}>
      <ToastProvider>
        <TimerProvider>
          <GradientBlobs />
          <div className="flex min-h-screen">
            <Sidebar page={page} />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={page}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Page />
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          </div>
          <MobileNav page={page} />
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <DeepWorkOverlay />
          <WelcomeModal />
        </TimerProvider>
      </ToastProvider>
    </AppContext.Provider>
  );
}
