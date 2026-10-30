import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Keeps a ✨ result for the rest of the session (it survives moving between pages), so a
 * result that used an action isn't lost by glancing at another page.
 */
export function useSavedResult<T>(key: readonly unknown[]) {
  const qc = useQueryClient();
  const queryKey = ['saved-ai-result', ...key];
  const { data } = useQuery<T | null>({ queryKey, queryFn: () => null, enabled: false, staleTime: Infinity, gcTime: Infinity });
  const save = useCallback((value: T | null) => qc.setQueryData(queryKey, value), [qc, JSON.stringify(queryKey)]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data ?? null, save] as const;
}
