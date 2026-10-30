import { describe, expect, it } from 'vitest';
import { looksLikeFeed, suggestCalendarName } from '../src/lib/calendars';

describe('calendar links', () => {
  it('suggests a name from the link so the URL can come first', () => {
    expect(suggestCalendarName('https://calendar.google.com/calendar/ical/abc/private-x/basic.ics')).toBe('Google Calendar');
    expect(suggestCalendarName('webcal://p01-caldav.icloud.com/published/2/abc')).toBe('iCloud calendar');
    expect(suggestCalendarName('https://www.timetable.uni.edu/feed.ics')).toBe('timetable.uni.edu');
    expect(suggestCalendarName('not a link')).toBe('');
  });

  it('spots feed links (which open in the Planner instead of downloading)', () => {
    expect(looksLikeFeed('https://calendar.google.com/calendar/ical/abc/basic.ics')).toBe(true);
    expect(looksLikeFeed('https://calendar.google.com/calendar/embed?src=abc')).toBe(false);
  });
});
