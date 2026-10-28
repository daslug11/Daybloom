import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Spinner } from './components/ui/States';
import { useAuth } from './hooks/useAuth';
import { isConfigured } from './lib/env';

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

const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const Onboarding = lazy(() => import('./pages/app/Onboarding'));
const BrainDump = lazy(() => import('./pages/app/BrainDump'));
const Tasks = lazy(() => import('./pages/app/Tasks'));
const Planner = lazy(() => import('./pages/app/Planner'));
const Calendars = lazy(() => import('./pages/app/Calendars'));
const Habits = lazy(() => import('./pages/app/Habits'));
const Goals = lazy(() => import('./pages/app/Goals'));
const Focus = lazy(() => import('./pages/app/Focus'));
const Mood = lazy(() => import('./pages/app/Mood'));
const Review = lazy(() => import('./pages/app/Review'));
const Settings = lazy(() => import('./pages/app/Settings'));

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
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
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
