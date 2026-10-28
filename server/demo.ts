/** A built-in demo feed (served at /api/demo-calendar.ics) so the Planner has real ICS events out of the box. */

export const DEMO_FEED_PATH = '/api/demo-calendar.ics';

function validTimeZone(tz: string | null | undefined) {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Today's calendar date as seen in `tz`. */
function todayIn(tz: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export function demoCalendarIcs(tzInput?: string | null, now = new Date()): string {
  const tz = validTimeZone(tzInput);
  const today = todayIn(tz, now);
  const monday = addDays(today, -((today.getUTCDay() + 6) % 7) - 7);
  const stamp = `${ymd(today)}T000000Z`;

  const timed = (uid: string, title: string, day: Date, start: string, end: string, extra: string[] = []) => [
    'BEGIN:VEVENT',
    `UID:${uid}@daybloom.demo`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tz}:${ymd(day)}T${start}00`,
    `DTEND;TZID=${tz}:${ymd(day)}T${end}00`,
    `SUMMARY:${title}`,
    ...extra,
    'END:VEVENT',
  ];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daybloom//Demo Calendar//EN',
    'X-WR-CALNAME:Daybloom Demo',
    ...timed('standup', 'Daily standup 🧍', monday, '0930', '0945', ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'LOCATION:Zoom']),
    ...timed('gym', 'Gym 🏋️', monday, '1800', '1900', ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']),
    ...timed('one-on-one', '1:1 with Jordan', addDays(monday, 3), '1100', '1130', ['RRULE:FREQ=WEEKLY']),
    ...timed('lunch', 'Lunch with Sam 🌮', today, '1230', '1330', ['LOCATION:Taco Place']),
    ...timed('design-review', 'Design review 🎨', addDays(today, 1), '1400', '1500'),
    ...timed('dentist', 'Dentist 🦷', addDays(today, 2), '1600', '1645'),
    'BEGIN:VEVENT',
    'UID:birthday@daybloom.demo',
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(addDays(today, 3))}`,
    `DTEND;VALUE=DATE:${ymd(addDays(today, 4))}`,
    "SUMMARY:Sam's birthday 🎂",
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
