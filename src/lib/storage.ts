/** Every localStorage key Daybloom uses, in one place. */
export const KEYS = {
  seeded: 'daybloom:seeded',
  settings: 'daybloom:settings',
  tasks: 'daybloom:tasks',
  focus: 'daybloom:focus',
  habits: 'daybloom:habits',
  moods: 'daybloom:moods',
  goals: 'daybloom:goals',
  notes: 'daybloom:notes',
  calendars: 'daybloom:calendars',
  calendarGroups: 'daybloom:calendar-groups',
  sessions: 'daybloom:focus-sessions',
  calendarsCollapsed: 'daybloom:calendars-collapsed',
} as const;

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(key: string, listener: Listener) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

export function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readStorage<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode — the in-memory UI still works for this session.
  }
  notify(key);
}

// Keep other tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key) notify(e.key);
  });
}
