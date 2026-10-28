import { useCallback, useEffect, useState } from 'react';
import type { PageId } from '../lib/types';

export const PAGES: PageId[] = ['dashboard', 'tasks', 'habits', 'focus', 'goals', 'notes', 'calendars', 'planner', 'review'];

function current(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, '') as PageId;
  return PAGES.includes(hash) ? hash : 'dashboard';
}

/** Minimal hash router — no dependency needed for eight pages. */
export function useRoute() {
  const [page, setPage] = useState<PageId>(current);

  useEffect(() => {
    const onHash = () => setPage(current());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((to: PageId) => {
    window.location.hash = `/${to}`;
  }, []);

  return { page, navigate };
}
