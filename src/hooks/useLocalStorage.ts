import { useCallback, useRef, useSyncExternalStore } from 'react';
import { readRaw, readStorage, subscribe, writeStorage } from '../lib/storage';

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

/**
 * Shared, typed localStorage state. Every component using the same key
 * stays in sync (including across tabs), so features can share data freely.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, SetValue<T>] {
  const initialRef = useRef(initial);
  const cache = useRef<{ raw: string | null; value: T } | null>(null);

  const getSnapshot = useCallback((): T => {
    const raw = readRaw(key);
    if (cache.current && cache.current.raw === raw) return cache.current.value;
    const value = raw === null ? initialRef.current : readStorage(key, initialRef.current);
    cache.current = { raw, value };
    return value;
  }, [key]);

  const value = useSyncExternalStore(
    useCallback((cb) => subscribe(key, cb), [key]),
    getSnapshot,
  );

  const setValue = useCallback<SetValue<T>>(
    (next) => {
      const prev = getSnapshot();
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      writeStorage(key, resolved);
    },
    [key, getSnapshot],
  );

  return [value, setValue];
}
