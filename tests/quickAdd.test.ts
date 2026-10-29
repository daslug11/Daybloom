import { describe, expect, it } from 'vitest';
import { parseQuickAdd, taskFromParsed } from '../src/lib/quickAdd';

// Wednesday, Oct 28 2026, 10:00 local time
const NOW = new Date(2026, 9, 28, 10, 0);

describe('parseQuickAdd', () => {
  it('parses the headline example', () => {
    expect(parseQuickAdd('gym tomorrow 6pm #health !high', NOW)).toEqual({
      title: 'gym',
      due: '2026-10-29',
      time: '18:00',
      tags: ['health'],
      priority: 'high',
      duration: undefined,
    });
  });

  it('handles weekdays, multiple tags, durations and low priority', () => {
    const p = parseQuickAdd('Write report on friday at 2:30pm for 90m #work #deep !low', NOW);
    expect(p).toMatchObject({ title: 'Write report', due: '2026-10-30', time: '14:30', tags: ['work', 'deep'], priority: 'low', duration: 90 });
  });

  it('keeps a date without a time unscheduled', () => {
    const p = parseQuickAdd('pay rent next monday', NOW);
    expect(p).toMatchObject({ title: 'pay rent', due: '2026-11-02', time: undefined });
    expect(taskFromParsed(p, 'x').sched_date).toBeUndefined();
  });

  it('keeps a duration without a time as an estimate', () => {
    const t = taskFromParsed(parseQuickAdd('tidy garage for 45m', NOW), 'x');
    expect(t).toMatchObject({ estimate_min: 45 });
    expect(t.sched_date).toBeUndefined();
  });

  it('reads time ranges as durations', () => {
    expect(parseQuickAdd('team offsite today 3-5pm', NOW)).toMatchObject({ title: 'team offsite', time: '15:00', duration: 120 });
  });

  it('leaves plain text alone', () => {
    expect(parseQuickAdd('Buy oat milk', NOW)).toEqual({ title: 'Buy oat milk', tags: [], due: undefined, time: undefined, priority: undefined, duration: undefined });
  });

  it('schedules tasks that have a date and time', () => {
    const task = taskFromParsed(parseQuickAdd('call mom tomorrow 6:10pm for 30m !2', NOW), 'x');
    expect(task).toMatchObject({ title: 'call mom', priority: 'medium', sched_date: '2026-10-29', sched_start: 18 * 60, sched_duration: 30 });
  });
});

import { layoutLanes, weekOf, timedEventsOn, allDayEventsOn } from '../src/lib/planner';

describe('planner helpers', () => {
  it('builds Monday-first weeks', () => {
    expect(weekOf('2026-10-28')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('puts overlapping blocks side by side', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 630 },
      { id: 'c', start: 660, end: 690 },
    ]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('c')).toEqual({ lane: 0, lanes: 1 });
  });

  it('clips multi-day events and finds all-day ones', () => {
    const late = { id: 'x', calendarId: 'c', title: 'Late', allDay: false, start: new Date(2026, 9, 28, 23).toISOString(), end: new Date(2026, 9, 29, 1).toISOString() };
    expect(timedEventsOn([late], '2026-10-28')[0]).toMatchObject({ start: 23 * 60, end: 24 * 60 });
    expect(timedEventsOn([late], '2026-10-29')[0]).toMatchObject({ start: 0, end: 60 });
    const bday = { id: 'y', calendarId: 'c', title: 'Bday', allDay: true, start: '2026-10-31', end: '2026-11-01' };
    expect(allDayEventsOn([bday], '2026-10-31')).toHaveLength(1);
    expect(allDayEventsOn([bday], '2026-11-01')).toHaveLength(0);
  });
});
