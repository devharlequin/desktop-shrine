import { describe, it, expect } from 'vitest';
import { timeOfDay, dayPhaseBlend, season, moonPhase } from './clock';

describe('timeOfDay', () => {
  it('classifies hours', () => {
    expect(timeOfDay(new Date(2026, 6, 10, 5, 30))).toBe('dawn');   // 05:00-07:59
    expect(timeOfDay(new Date(2026, 6, 10, 12, 0))).toBe('day');    // 08:00-17:59
    expect(timeOfDay(new Date(2026, 6, 10, 18, 30))).toBe('dusk');  // 18:00-20:59
    expect(timeOfDay(new Date(2026, 6, 10, 23, 0))).toBe('night');  // 21:00-04:59
    expect(timeOfDay(new Date(2026, 6, 10, 2, 0))).toBe('night');
  });
});

describe('dayPhaseBlend', () => {
  it('is 0 at phase start and ~1 at phase end', () => {
    expect(dayPhaseBlend(new Date(2026, 6, 10, 5, 0))).toBeCloseTo(0, 2);
    expect(dayPhaseBlend(new Date(2026, 6, 10, 7, 59))).toBeGreaterThan(0.98);
  });
});

describe('season', () => {
  it('maps months (northern hemisphere)', () => {
    expect(season(new Date(2026, 0, 15))).toBe('winter');
    expect(season(new Date(2026, 3, 15))).toBe('spring');
    expect(season(new Date(2026, 6, 15))).toBe('summer');
    expect(season(new Date(2026, 9, 15))).toBe('autumn');
  });
});

describe('moonPhase', () => {
  it('returns 0..1 and known anchors', () => {
    // Known new moon: 2000-01-06 18:14 UTC -> phase ~0
    expect(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toBeCloseTo(0, 1);
    // Half a synodic month later -> full (~0.5)
    expect(moonPhase(new Date(Date.UTC(2000, 0, 21, 4, 40)))).toBeCloseTo(0.5, 1);
  });
});
