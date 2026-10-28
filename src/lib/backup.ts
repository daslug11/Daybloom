import { CALENDAR_COLORS, parseCalendarUrl } from './calendars';
import type { CalendarGroup, CalendarLink } from './types';
import { uid } from './utils';

export interface CalendarBackup {
  app: 'daybloom';
  kind: 'calendars';
  version: 1;
  exportedAt: string;
  groups: CalendarGroup[];
  calendars: CalendarLink[];
}

export function makeCalendarBackup(calendars: CalendarLink[], groups: CalendarGroup[]): CalendarBackup {
  return { app: 'daybloom', kind: 'calendars', version: 1, exportedAt: new Date().toISOString(), groups, calendars };
}

const colorOk = (n: unknown) => (typeof n === 'number' && n >= 0 && n < CALENDAR_COLORS.length ? n : 0);

/** Merge an imported backup into existing data. Skips calendars whose URL already exists. */
export function importCalendarBackup(data: unknown, calendars: CalendarLink[], groups: CalendarGroup[]) {
  if (!data || typeof data !== 'object' || !Array.isArray((data as CalendarBackup).calendars)) {
    throw new Error('not a Daybloom calendar backup');
  }
  const backup = data as Partial<CalendarBackup>;

  const nextGroups = [...groups];
  const groupMap = new Map<string, string>(); // imported id → local id
  for (const g of Array.isArray(backup.groups) ? backup.groups : []) {
    if (!g || typeof g.name !== 'string' || typeof g.id !== 'string') continue;
    const existing = nextGroups.find((x) => x.name.toLowerCase() === g.name.toLowerCase());
    if (existing) groupMap.set(g.id, existing.id);
    else {
      const id = nextGroups.some((x) => x.id === g.id) ? uid() : g.id;
      nextGroups.push({ id, name: g.name, color: colorOk(g.color) });
      groupMap.set(g.id, id);
    }
  }

  const known = new Set(calendars.map((c) => c.url.trim()));
  const added: CalendarLink[] = [];
  for (const c of backup.calendars ?? []) {
    if (!c || typeof c.url !== 'string' || !parseCalendarUrl(c.url) || known.has(c.url.trim())) continue;
    known.add(c.url.trim());
    added.push({
      id: uid(),
      name: typeof c.name === 'string' && c.name.trim() ? c.name : 'Imported calendar',
      url: c.url.trim(),
      emoji: typeof c.emoji === 'string' && c.emoji ? c.emoji : '📅',
      color: colorOk(c.color),
      groupId: c.groupId ? groupMap.get(c.groupId) ?? null : null,
      pinned: !!c.pinned,
      sync: !!c.sync,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
    });
  }
  return { groups: nextGroups, calendars: [...calendars, ...added], added: added.length };
}
