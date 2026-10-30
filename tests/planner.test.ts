import { describe, expect, it } from 'vitest';
import { edgeScrollSpeed, moveBlock, nudgeBlock, parseTimeInput, resizeBlock, sameBlock, slotFloor, snap } from '../src/lib/planner';

const b = { date: '2026-11-02', start: 9 * 60, duration: 60 };

describe('planner block maths', () => {
  it('snaps to 15 minutes and picks the slot under the pointer', () => {
    expect(snap(7)).toBe(0);
    expect(snap(8)).toBe(15);
    expect(slotFloor(14)).toBe(0);
    expect(slotFloor(15)).toBe(15);
    expect(slotFloor(29.9)).toBe(15);
  });

  it('moves blocks in 15-minute steps and keeps them inside the day', () => {
    expect(moveBlock(b, 16)).toEqual({ ...b, start: 555 });
    expect(moveBlock(b, -10_000).start).toBe(0);
    expect(moveBlock(b, 10_000).start).toBe(23 * 60);
    expect(moveBlock(b, 0, '2026-11-03')).toEqual({ ...b, date: '2026-11-03' });
  });

  it('resizes to at least 15 minutes and never past midnight', () => {
    expect(resizeBlock(b, 15).duration).toBe(75);
    expect(resizeBlock(b, -500).duration).toBe(15);
    expect(resizeBlock({ ...b, start: 23 * 60 }, 500).duration).toBe(60);
  });

  it('nudges with the keyboard', () => {
    expect(nudgeBlock(b, 'ArrowUp', false)).toEqual({ ...b, start: 525 });
    expect(nudgeBlock(b, 'ArrowDown', false)).toEqual({ ...b, start: 555 });
    expect(nudgeBlock(b, 'ArrowDown', true)).toEqual({ ...b, duration: 75 });
    expect(nudgeBlock(b, 'ArrowUp', true)).toEqual({ ...b, duration: 45 });
    expect(nudgeBlock(b, 'ArrowRight', false)).toEqual({ ...b, date: '2026-11-03' });
    expect(nudgeBlock(b, 'ArrowLeft', false)).toEqual({ ...b, date: '2026-11-01' });
    expect(nudgeBlock(b, 'Enter', false)).toBeNull();
    expect(nudgeBlock({ ...b, start: 0 }, 'ArrowUp', false)?.start).toBe(0);
  });

  it('compares blocks', () => {
    expect(sameBlock(b, { ...b })).toBe(true);
    expect(sameBlock(b, { ...b, start: 0 })).toBe(false);
    expect(sameBlock(b, null)).toBe(false);
  });

  it('auto-scrolls faster the deeper the pointer is in the edge zone', () => {
    expect(edgeScrollSpeed(300, 0, 600)).toBe(0);
    expect(edgeScrollSpeed(40, 0, 600)).toBeLessThan(0);
    expect(edgeScrollSpeed(0, 0, 600)).toBe(-18);
    expect(edgeScrollSpeed(-50, 0, 600)).toBe(-18);
    expect(edgeScrollSpeed(560, 0, 600)).toBeGreaterThan(0);
    expect(edgeScrollSpeed(590, 0, 600)).toBeGreaterThan(edgeScrollSpeed(560, 0, 600));
  });

  it('reads time inputs', () => {
    expect(parseTimeInput('14:05')).toBe(14 * 60);
    expect(parseTimeInput('09:08')).toBe(9 * 60 + 15);
    expect(parseTimeInput('23:59')).toBe(23 * 60 + 45);
    expect(parseTimeInput('')).toBeNull();
  });
});
