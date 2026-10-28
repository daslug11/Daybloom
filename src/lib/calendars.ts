import type { CalendarType } from './types';

export const CALENDAR_COLORS = [
  { name: 'Grape', from: '#8b5cf6', to: '#6366f1' },
  { name: 'Ocean', from: '#3b82f6', to: '#06b6d4' },
  { name: 'Bubblegum', from: '#ec4899', to: '#f43f5e' },
  { name: 'Sunset', from: '#f97316', to: '#facc15' },
  { name: 'Mint', from: '#10b981', to: '#84cc16' },
  { name: 'Aurora', from: '#a855f7', to: '#ec4899' },
  { name: 'Lagoon', from: '#14b8a6', to: '#3b82f6' },
  { name: 'Ember', from: '#ef4444', to: '#f59e0b' },
];

export function gradient(color: number, dir = '135deg') {
  const c = CALENDAR_COLORS[color] ?? CALENDAR_COLORS[0];
  return `linear-gradient(${dir}, ${c.from}, ${c.to})`;
}

export const CALENDAR_TYPES: Record<CalendarType, { label: string; emoji: string }> = {
  google: { label: 'Google Calendar', emoji: '🟦' },
  outlook: { label: 'Outlook', emoji: '📨' },
  apple: { label: 'Apple / iCloud', emoji: '🍎' },
  notion: { label: 'Notion', emoji: '📓' },
  calendly: { label: 'Calendly', emoji: '🗓️' },
  ics: { label: 'ICS feed', emoji: '📡' },
  other: { label: 'Other', emoji: '🔗' },
};

export const CALENDAR_EMOJIS = ['📅', '🗓️', '💼', '🏠', '🎓', '🏋️', '🎉', '✈️', '🍽️', '💜', '🧠', '⚽', '🎵', '👨‍👩‍👧', '🩺', '🚀'];

/** Accepts http(s) and webcal links. Returns a parsed URL or null. */
export function parseCalendarUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:', 'webcal:'].includes(url.protocol)) return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url;
  } catch {
    return null;
  }
}

export function validateCalendarUrl(input: string): string | null {
  if (!input.trim()) return 'Paste a link to your calendar 🔗';
  if (!/^[a-z]+:\/\//i.test(input.trim())) return 'Links should start with https:// (or webcal://) 🙏';
  if (!parseCalendarUrl(input)) return "Hmm, that doesn't look like a valid link 🤔";
  return null;
}

export function detectCalendarType(input: string): CalendarType {
  const url = parseCalendarUrl(input);
  if (!url) return 'other';
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host === 'calendar.google.com' || (host.endsWith('google.com') && path.startsWith('/calendar'))) return 'google';
  if (host.startsWith('outlook.') || host.endsWith('outlook.com') || host.endsWith('office365.com') || host.endsWith('office.com')) return 'outlook';
  if (host.endsWith('icloud.com')) return 'apple';
  if (host.endsWith('notion.so') || host.endsWith('notion.site') || host.endsWith('notion.com')) return 'notion';
  if (host.endsWith('calendly.com')) return 'calendly';
  if (url.protocol === 'webcal:' || path.endsWith('.ics') || path.endsWith('/ical')) return 'ics';
  return 'other';
}

export function isGoogleEmbed(input: string) {
  const url = parseCalendarUrl(input);
  return !!url && url.hostname === 'calendar.google.com' && url.pathname.startsWith('/calendar/embed');
}

/** Heuristic for "this link is probably an ICS feed", used to pre-enable sync. */
export function looksLikeFeed(input: string) {
  const url = parseCalendarUrl(input);
  if (!url) return false;
  const path = url.pathname.toLowerCase();
  return (
    url.protocol === 'webcal:' ||
    path.endsWith('.ics') ||
    path.includes('/ical/') ||
    path.endsWith('/ical') ||
    (url.hostname.endsWith('icloud.com') && path.includes('/published/'))
  );
}
