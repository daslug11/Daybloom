import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spinner } from './components/ui/States';
import { useAuth } from './hooks/useAuth';
import { isConfigured } from './lib/env';

// The signed-in shell (capture, palette, timer, date parsing) is its own chunk, so public pages don't
// download it. On /app URLs it starts loading straight away, alongside the auth check.
const loadShell = () => import('./components/layout/AppShell').then((m) => ({ default: m.AppShell }));
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) void loadShell();
const AppShell = lazy(loadShell);

const Landing = lazy(() => import('./pages/public/Landing'));
const SignUp = lazy(() => import('./pages/auth/SignUp'));
const LogIn = lazy(() => import('./pages/auth/LogIn'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));
const Terms = lazy(() => import('./pages/public/Terms'));
const Privacy = lazy(() => import('./pages/public/Privacy'));
const NotFound = lazy(() => import('./pages/public/NotFound'));
const Admin = lazy(() => import('./pages/Admin'));
const SharedSpace = lazy(() => import('./pages/public/SharedSpace'));

// Signed-in pages, by path segment. The current one is fetched alongside the shell instead of after it.
const appPages = {
  '': () => import('./pages/app/Dashboard'),
  welcome: () => import('./pages/app/Onboarding'),
  'brain-dump': () => import('./pages/app/BrainDump'),
  tasks: () => import('./pages/app/Tasks'),
  planner: () => import('./pages/app/Planner'),
  calendars: () => import('./pages/app/Calendars'),
  habits: () => import('./pages/app/Habits'),
  goals: () => import('./pages/app/Goals'),
  focus: () => import('./pages/app/Focus'),
  mood: () => import('./pages/app/Mood'),
  review: () => import('./pages/app/Review'),
  settings: () => import('./pages/app/Settings'),
  spaces: () => import('./pages/app/spaces/SpacesIndex'),
};
const loadSpacePage = () => import('./pages/app/spaces/SpacePage');
const loadNewSpace = () => import('./pages/app/spaces/NewSpace');
if (typeof window !== 'undefined') {
  const m = window.location.pathname.match(/^\/app\/?([^/]*)/);
  if (m && m[1] in appPages) void appPages[m[1] as keyof typeof appPages]();
  const sp = window.location.pathname.match(/^\/app\/spaces\/([^/]+)/);
  if (sp) void (sp[1] === 'new' ? loadNewSpace() : loadSpacePage());
}
const Dashboard = lazy(appPages['']);
const Onboarding = lazy(appPages.welcome);
const BrainDump = lazy(appPages['brain-dump']);
const Tasks = lazy(appPages.tasks);
const Planner = lazy(appPages.planner);
const Calendars = lazy(appPages.calendars);
const Habits = lazy(appPages.habits);
const Goals = lazy(appPages.goals);
const Focus = lazy(appPages.focus);
const Mood = lazy(appPages.mood);
const Review = lazy(appPages.review);
const Settings = lazy(appPages.settings);
const SpacesIndex = lazy(appPages.spaces);
const SpacePage = lazy(loadSpacePage);
const NewSpace = lazy(loadNewSpace);

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner size={24} />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

/** Signed-in visitors skip the marketing and auth pages and go straight to the app. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm">
        <h1 className="text-lg font-bold">Daybloom isn't configured yet</h1>
        <p className="muted mt-2">Set SUPABASE_URL and SUPABASE_ANON_KEY (see README → Environment variables) and rebuild.</p>
      </div>
    );
  }
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><LogIn /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/s/:token" element={<SharedSpace />} />
        <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="welcome" element={<Onboarding />} />
          <Route path="brain-dump" element={<BrainDump />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="planner" element={<Planner />} />
          <Route path="calendars" element={<Calendars />} />
          <Route path="habits" element={<Habits />} />
          <Route path="goals" element={<Goals />} />
          <Route path="focus" element={<Focus />} />
          <Route path="mood" element={<Mood />} />
          <Route path="review" element={<Review />} />
          <Route path="settings" element={<Settings />} />
          <Route path="spaces" element={<SpacesIndex />} />
          <Route path="spaces/new" element={<NewSpace />} />
          <Route path="spaces/:id" element={<SpacePage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
