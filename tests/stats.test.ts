import { describe, expect, it } from 'vitest';
import { deltaText, focusStats, habitDays, habitStartDay, habitWeekLabel, lastDays, meanScore } from '../src/lib/stats';

const today = '2026-10-29'; // a Thursday
const week = lastDays(today, 7);

describe('habit-days', () => {
  it('lists the last 7 days ending today', () => {
    expect(week).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
  });

  it('starts at the earlier of creation and the first log', () => {
    expect(habitStartDay('2026-10-27', ['2026-10-28'])).toBe('2026-10-27');
    expect(habitStartDay('2026-10-27', ['2026-10-25', '2026-10-28'])).toBe('2026-10-25');
    expect(habitStartDay('2026-10-27', [])).toBe('2026-10-27');
  });

  it('does not count today as a miss until it is done', () => {
    const logs = new Set(['2026-10-27', '2026-10-28']);
    expect(habitDays({ start: '2026-10-01', logDays: logs, days: week, today })).toEqual({ done: 2, possible: 6 });
    logs.add(today);
    expect(habitDays({ start: '2026-10-01', logDays: logs, days: week, today })).toEqual({ done: 3, possible: 7 });
  });

  it('ignores days before the habit started and future days', () => {
    const logs = new Set(['2026-10-28']);
    expect(habitDays({ start: '2026-10-27', logDays: logs, days: week, today })).toEqual({ done: 1, possible: 2 });
    expect(habitDays({ start: '2026-10-27', logDays: logs, days: [...week, '2026-10-30'], today })).toEqual({ done: 1, possible: 2 });
  });

  it('counts a log before creation (imported history) as the start', () => {
    const logs = new Set(['2026-10-24']);
    const start = habitStartDay('2026-10-28', logs);
    expect(habitDays({ start, logDays: logs, days: week, today })).toEqual({ done: 1, possible: 5 });
  });

  it('labels the rolling week honestly', () => {
    expect(habitWeekLabel('2026-10-01', new Set(['2026-10-28', today]), today)).toBe('2 of the last 7 days');
    expect(habitWeekLabel('2026-10-27', new Set(['2026-10-28']), today)).toBe('1 of 2 days since you started');
    expect(habitWeekLabel(today, new Set(), today)).toBe('Started today');
    expect(habitWeekLabel(today, new Set([today]), today)).toBe('1 of 1 day since you started');
  });
});

describe('mean score', () => {
  it('is null with no data, never 0', () => {
    expect(meanScore([])).toBeNull();
    expect(meanScore([3, 4])).toBe(3.5);
  });
});

describe('focus stats', () => {
  const at = (day: string, h = 12) => `${day}T${String(h).padStart(2, '0')}:00:00Z`;
  const sessions = [
    { task_id: 'a', started_at: at('2026-10-29'), minutes: 25 },
    { task_id: 'a', started_at: at('2026-10-28'), minutes: 25 },
    { task_id: 'b', started_at: at('2026-10-27'), minutes: 50 },
    { task_id: null, started_at: at('2026-10-27'), minutes: 15 },
    { task_id: 'c', started_at: at('2026-10-20'), minutes: 90 }, // older than 7 days
  ];

  it('totals by day and keeps untasked minutes so rows add up', () => {
    const s = focusStats(sessions, today, 'UTC');
    expect(s.today).toBe(25);
    expect(s.weekTotal).toBe(115);
    expect(s.week.map((w) => w.minutes)).toEqual([0, 0, 0, 0, 65, 25, 25]);
    expect(s.topTasks).toEqual([
      ['a', 50],
      ['b', 50],
    ]);
    expect(s.noTask).toBe(15);
    expect(s.topTasks.reduce((a, [, m]) => a + m, 0) + s.otherTasks + s.noTask).toBe(s.weekTotal);
  });

  it('folds tasks beyond the top N into "other"', () => {
    const s = focusStats(sessions, today, 'UTC', 1);
    expect(s.topTasks).toHaveLength(1);
    expect(s.otherTasks).toBe(50);
    expect(s.otherTaskCount).toBe(1);
  });
});

describe('delta text', () => {
  it('says the direction in words', () => {
    expect(deltaText(3)).toBe('3 more than the 7 days before');
    expect(deltaText(-2)).toBe('2 fewer than the 7 days before');
    expect(deltaText(0)).toBe('Same as the 7 days before');
  });
});
