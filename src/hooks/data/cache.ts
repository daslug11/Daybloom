import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '../useToast';

/**
 * Optimistic mutation over a cached list: applies `optimistic` to the cached
 * array immediately, rolls back and shows a toast if the request fails, then
 * refetches. Keeps every page snappy without hand-written cache code.
 */
export function useListMutation<TVars, TItem, TResult = unknown>(
  key: QueryKey,
  mutationFn: (vars: TVars) => Promise<TResult>,
  optimistic?: (list: TItem[], vars: TVars) => TItem[],
  errorMessage = 'That change could not be saved. Please try again.',
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      if (!optimistic) return {};
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TItem[]>(key);
      if (prev) qc.setQueryData<TItem[]>(key, optimistic(prev, vars));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx && 'prev' in ctx && ctx.prev) qc.setQueryData(key, ctx.prev);
      console.error(err);
      toast(errorMessage);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Throws Supabase errors so React Query treats them as failures. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const tempId = () => `temp-${Math.random().toString(36).slice(2)}`;
