import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PublicLayout } from './PublicLayout';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-5xl" aria-hidden>
          🧭
        </div>
        <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
        <p className="muted mt-2 text-sm">That link doesn’t go anywhere in Daybloom.</p>
        <Link to={user ? '/app' : '/'} className="btn-primary mt-6">
          {user ? 'Back to your dashboard' : 'Go to the home page'}
        </Link>
      </div>
    </PublicLayout>
  );
}
