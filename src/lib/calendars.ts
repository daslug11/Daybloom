import type React from 'react';
import type { CalendarType } from './types';

/**
 * A calendar's identity colour, stored by position, so the order must not change.
 * Solid colours only; none of them is cyan, which is reserved for Atlas.
 */
export const CALENDAR_COLORS = [
  { name: 'Grape', hex: '#8b5cf6' },
  { name: 'Ocean', hex: '#3b82f6' },
  { name: 'Bubblegum', hex: '#ec4899' },
  { name: 'Sunset', hex: '#f97316' },
  { name: 'Mint', hex: '#10b981' },
  { name: 'Plum', hex: '#c026d3' },
  { name: 'Graphite', hex: '#71717a' },
  { name: 'Ember', hex: '#ef4444' },
];

export function calendarColor(color: number) {
  return (CALENDAR_COLORS[color] ?? CALENDAR_COLORS[0]).hex;
}

/** An emoji tile tinted with the calendar's colour. */
export function calendarTile(color: number): React.CSSProperties {
  const hex = calendarColor(color);
  return { background: `${hex}26`, boxShadow: `inset 0 0 0 1px ${hex}59` };
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

/** A starting name for a pasted link ("Google Calendar", "timetable.uni.edu"), so the URL can come first. */
export function suggestCalendarName(input: string): string {
  const url = parseCalendarUrl(input);
  if (!url) return '';
  const type = detectCalendarType(input);
  if (type === 'google') return 'Google Calendar';
  if (type === 'outlook') return 'Outlook calendar';
  if (type === 'apple') return 'iCloud calendar';
  if (type === 'notion') return 'Notion calendar';
  if (type === 'calendly') return 'Calendly';
  return url.hostname.replace(/^www\./, '');
}
