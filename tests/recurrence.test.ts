import { describe, expect, it } from 'vitest';
import { availabilityText, normalizeSessions, planConflicts } from '../server/data/plans';
import { expandSeries, findFreeSlot, groupSessions, isoWeekday, planEndDate, planOccurrences, planProgress, sessionLine, type SeriesRow } from '../server/data/recurrence';

const series: SeriesRow = { id: 's1', plan_id: 'p1', title: 'Legs', details: 'squats', days: [1, 3], start_min: 1080, duration_min: 45, start_date: '2026-11-02', end_date: '2026-11-15' };
const row = (day: string, extra = {}) => ({ series_id: 's1', day, done_at: null, skipped: false, start_min: null, duration_min: null, title: null, details: null, ...extra });

describe('recurring blocks', () => {
  it('knows ISO weekdays and plan end dates', () => {
    expect(isoWeekday('2026-11-02')).toBe(1);
    expect(isoWeekday('2026-11-08')).toBe(7);
    expect(planEndDate('2026-10-30', 4)).toBe('2026-11-26');
  });

  it('expands weekly on chosen days between the start and end date', () => {
    expect(expandSeries([series], [], '2026-10-01', '2026-12-31').map((o) => o.day)).toEqual(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11']);
    expect(expandSeries([series], [], '2026-11-03', '2026-11-09').map((o) => o.day)).toEqual(['2026-11-04', '2026-11-09']);
  });

  it('applies "this one only" changes, skips and check-offs', () => {
    const rows = [row('2026-11-04', { start_min: 1140, title: 'Legs (late)' }), row('2026-11-09', { skipped: true }), row('2026-11-11', { done_at: '2026-11-11T19:00:00Z' })];
    const occ = expandSeries([series], rows, '2026-11-01', '2026-11-30');
    expect(occ.map((o) => [o.day, o.start, o.title, o.done, o.edited])).toEqual([
      ['2026-11-02', 1080, 'Legs', false, false],
      ['2026-11-04', 1140, 'Legs (late)', false, true],
      ['2026-11-11', 1080, 'Legs', true, false],
    ]);
    expect(expandSeries([series], rows, '2026-11-01', '2026-11-30', { withSkipped: true })).toHaveLength(4);
  });

  it('reports plan progress without counting skipped sessions', () => {
    const occ = expandSeries([series], [row('2026-11-02', { done_at: 'x' }), row('2026-11-09', { skipped: true })], '2026-11-02', '2026-11-15', { withSkipped: true });
    expect(planProgress('2026-11-02', 2, occ, '2026-11-10')).toMatchObject({ week: 2, weeks: 2, done: 1, total: 3, finished: false });
    expect(planProgress('2026-11-02', 2, occ, '2026-11-01').week).toBe(0);
    expect(planProgress('2026-11-02', 2, occ, '2026-11-16').finished).toBe(true);
  });
});

describe('plans', () => {
  const sessions = normalizeSessions([
    { day: 'Monday', start: '18:05', duration_min: 44, title: 'Legs', details: 'squats' },
    { day: 'Wed', start: '18:00', duration_min: 45, title: 'Legs', details: 'squats' },
    { day: 'fri', start: '07:00', duration_min: 30, title: 'Run' },
    { day: 'Fri', start: '07:15', duration_min: 30, title: 'Overlaps the run' },
    { day: 'Funday', start: '07:00', duration_min: 30, title: 'Bad day' },
    { day: 'Sat', start: '23:30', duration_min: 60, title: 'Past midnight' },
  ]);

  it('cleans model output onto the grid and drops invalid or overlapping sessions', () => {
    expect(sessions).toEqual([
      { day: 1, start: 1080, duration: 45, title: 'Legs', details: 'squats' },
      { day: 3, start: 1080, duration: 45, title: 'Legs', details: 'squats' },
      { day: 5, start: 420, duration: 30, title: 'Run', details: '' },
    ]);
  });

  it('formats sessions for the card', () => {
    expect(sessionLine(sessions[0])).toBe('Mon 6:00 PM · 45 min · Legs: squats');
    expect(sessionLine(sessions[2])).toBe('Fri 7:00 AM · 30 min · Run');
  });

  it('groups identical sessions into one weekly series', () => {
    expect(groupSessions(sessions)).toEqual([
      { days: [1, 3], start: 1080, duration: 45, title: 'Legs', details: 'squats' },
      { days: [5], start: 420, duration: 30, title: 'Run', details: '' },
    ]);
  });

  it('lists dated occurrences and finds conflicts', () => {
    const occ = planOccurrences(sessions, '2026-10-30', 2);
    expect(occ.map((o) => o.day)).toEqual(['2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11']);
    const busy = [{ day: '2026-11-04', start: 1050, end: 1110, title: 'Dentist', kind: 'event' as const }];
    expect(planConflicts(sessions, '2026-10-30', 2, busy)).toEqual([{ day: '2026-11-04', title: 'Legs', with: 'Dentist' }]);
  });

  it('finds the nearest free slot for a shifted session', () => {
    expect(findFreeSlot([{ start: 1050, end: 1110 }], 1080, 45)).toBe(1110);
    expect(findFreeSlot([{ start: 0, end: 1440 }], 1080, 45)).toBeNull();
  });

  it('summarises busy times by weekday for Atlas', () => {
    const text = availabilityText(
      [
        { day: '2026-11-02', start: 540, end: 1020, title: 'Work', kind: 'event' },
        { day: '2026-11-09', start: 540, end: 1020, title: 'Work', kind: 'event' },
      ],
      '2026-11-02',
      2,
    );
    expect(text).toContain('Mon: 09:00-17:00 Work (calendar, 2 of 2 wks)');
    expect(text).toContain('Tue: free');
  });
});
