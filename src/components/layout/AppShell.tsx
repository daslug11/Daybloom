import { Plus } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppActionsContext, type AppActions, type CaptureMode } from '../../hooks/useAppActions';
import { useProfile, useThemeSync } from '../../hooks/useProfile';
import { TimerProvider } from '../../hooks/useTimer';
import { AtlasOrb } from '../atlas/AtlasOrb';
import { CaptureComposer } from '../capture/CaptureComposer';
import { LocalImportPrompt } from '../onboarding/LocalImportPrompt';
import { ErrorState, Spinner } from '../ui/States';
import { CommandPalette } from './CommandPalette';
import { FocusOverlay } from './FocusOverlay';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const AtlasPanel = lazy(() => import('../atlas/AtlasPanel'));
const VoiceHud = lazy(() => import('../atlas/VoiceHud'));
const Tour = lazy(() => import('../onboarding/Tour'));

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Layout for signed-in pages: navigation, capture, Atlas, palette and timer. */
export function AppShell() {
  useThemeSync();
  const profile = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [capture, setCapture] = useState<{ open: boolean; mode: CaptureMode; text: string; voice: boolean }>({ open: false, mode: 'note', text: '', voice: false });
  const [atlas, setAtlas] = useState<{ open: boolean; prefill: string }>({ open: false, prefill: '' });
  const [voice, setVoice] = useState(false);
  const [palette, setPalette] = useState(false);
  const [tour, setTour] = useState(false);

  const openCapture = useCallback<AppActions['openCapture']>((opts = {}) => {
    setCapture({ open: true, mode: opts.mode ?? 'note', text: opts.text ?? '', voice: !!opts.voice });
  }, []);
  const openAtlas = useCallback((prefill = '') => setAtlas({ open: true, prefill }), []);
  const openVoice = useCallback(() => setVoice(true), []);
  const openPalette = useCallback(() => setPalette(true), []);
  const startTour = useCallback(() => {
    navigate('/app');
    setTour(true);
  }, [navigate]);

  const actions = useMemo<AppActions>(() => ({ openCapture, openAtlas, openVoice, openPalette, startTour }), [openCapture, openAtlas, openVoice, openPalette, startTour]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((o) => !o);
      } else if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAtlas((a) => ({ open: !a.open, prefill: '' }));
      } else if (!mod && !e.altKey && e.key.toLowerCase() === 'n' && !isTyping(e.target) && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        openCapture();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openCapture]);

  // Start the guided tour right after onboarding (?tour=1).
  useEffect(() => {
    if (new URLSearchParams(location.search).get('tour') === '1') {
      setTour(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  if (profile.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading your account" size={24} />
      </div>
    );
  }
  if (profile.error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ErrorState message="Couldn't load your account. Check your connection." onRetry={() => profile.refetch()} />
      </div>
    );
  }
  if (profile.data && !profile.data.onboarded_at && location.pathname !== '/app/welcome') {
    return <Navigate to="/app/welcome" replace />;
  }
  if (location.pathname === '/app/welcome') {
    return (
      <AppActionsContext.Provider value={actions}>
        <Outlet />
      </AppActionsContext.Provider>
    );
  }

  return (
    <AppActionsContext.Provider value={actions}>
      <TimerProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-overlay focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          Skip to content
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 sm:px-6 md:pb-16 lg:px-8">
              <Suspense
                fallback={
                  <div className="flex justify-center py-20">
                    <Spinner size={24} />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
        <MobileNav />

        <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
          <button
            onClick={() => openCapture()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-pop transition-colors duration-fast hover:bg-accent/90 focus-visible:ring-offset-2"
            aria-label="Capture (N)"
            title="Capture a note or task (N)"
          >
            <Plus size={22} aria-hidden />
          </button>
          <AtlasOrb onClick={() => setAtlas({ open: true, prefill: '' })} />
        </div>

        <CaptureComposer
          open={capture.open}
          initialMode={capture.mode}
          initialText={capture.text}
          startVoice={capture.voice}
          onClose={() => setCapture((c) => ({ ...c, open: false }))}
        />
        <CommandPalette open={palette} onClose={() => setPalette(false)} />
        <FocusOverlay />
        <LocalImportPrompt />
        <Suspense fallback={null}>
          {atlas.open && (
            <AtlasPanel
              prefill={atlas.prefill}
              onClose={() => setAtlas({ open: false, prefill: '' })}
              onVoice={() => {
                setAtlas({ open: false, prefill: '' });
                setVoice(true);
              }}
            />
          )}
          {voice && <VoiceHud onClose={() => setVoice(false)} />}
          {tour && <Tour onClose={() => setTour(false)} />}
        </Suspense>
      </TimerProvider>
    </AppActionsContext.Provider>
  );
}
