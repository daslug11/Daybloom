import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, type AiResponse, type AiStatus } from '../lib/api';
import { useUserId } from './useAuth';
import { useToast } from './useToast';

export const aiStatusKey = (uid: string) => ['ai-status', uid];

/** "✨ 14 left today" and whether AI is available right now. */
export function useAiStatus() {
  const uid = useUserId();
  return useQuery({
    queryKey: aiStatusKey(uid),
    enabled: !!uid,
    queryFn: () => apiFetch<AiStatus>('/api/ai'),
    staleTime: 60_000,
    retry: 1,
  });
}

/** Keeps the allowance badge accurate after any AI call (or limit error). */
export function useAiStatusUpdater() {
  const qc = useQueryClient();
  const uid = useUserId();
  return (remaining: number | null | undefined, extra: Partial<AiStatus> = {}) => {
    qc.setQueryData<AiStatus>(aiStatusKey(uid), (prev) =>
      prev ? { ...prev, ...(remaining != null ? { remaining } : {}), ...extra } : prev,
    );
    if (remaining == null && !Object.keys(extra).length) qc.invalidateQueries({ queryKey: aiStatusKey(uid) });
  };
}

/** Runs one ✨ feature on demand. Errors (limits, pauses) show as a toast. */
export function useAi<T>(feature: string) {
  const update = useAiStatusUpdater();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: Record<string, unknown> = {}) => apiFetch<AiResponse<T>>('/api/ai', { feature, ...input }),
    onSuccess: (data) => update(data.remaining),
    onError: (err) => {
      if (err instanceof ApiError) {
        const reason = err.data.reason as string | undefined;
        if (reason === 'daily_limit') update(0);
        if (reason?.startsWith('paused')) update(null, { enabled: false, paused: true, message: err.message });
        toast(err.message);
      } else toast('Something went wrong. Please try again.');
    },
  });
}
