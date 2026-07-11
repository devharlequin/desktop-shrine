export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

const PHASES: Array<[TimeOfDay, number, number]> = [
  ['dawn', 5, 8],
  ['day', 8, 18],
  ['dusk', 18, 21],
  ['night', 21, 29], // wraps past midnight to 05:00
];

export function timeOfDay(d: Date): TimeOfDay {
  const h = d.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'dusk';
  return 'night';
}

/** 0..1 progress through the current phase. */
export function dayPhaseBlend(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  const hh = h < 5 ? h + 24 : h; // night wraps
  for (const [, start, end] of PHASES) {
    if (hh >= start && hh < end) return (hh - start) / (end - start);
  }
  return 0;
}

export function season(d: Date): Season {
  const m = d.getMonth(); // 0-based
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

const SYNODIC = 29.53058867; // days
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

/** 0 = new, 0.5 = full, wraps at 1. */
export function moonPhase(d: Date): number {
  const days = (d.getTime() - NEW_MOON_EPOCH) / 86_400_000;
  return (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
}
