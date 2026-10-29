import { useQueryClient } from '@tanstack/react-query';
import { useUserId } from './useAuth';

/** Refreshes everything Atlas (or an import) may have changed. */
export function useInvalidateUserData() {
  const qc = useQueryClient();
  const uid = useUserId();
  return () => {
    for (const key of ['tasks', 'notes', 'habits', 'habit_logs', 'goals', 'milestones', 'moods', 'atlas_messages', 'atlas_pending', 'calendars', 'plans', 'block_series', 'series_occurrences']) {
      qc.invalidateQueries({ queryKey: [key, uid] });
    }
  };
}
