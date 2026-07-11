import { timeOfDay } from './clock';

export type Activity = 'sweeping' | 'idle' | 'tending' | 'lighting-candles' | 'sleeping' | 'ceremony';
export interface ClaudingState { activity: Activity }

/** The keeper-in-residence: a daily routine with a ceremony interrupt. */
export class ClaudingBrain {
  candlesLit = false;
  private inCeremony = false;

  beginCeremony() { this.inCeremony = true; }
  endCeremony() { this.inCeremony = false; }

  tick(now: Date): ClaudingState {
    if (this.inCeremony) return { activity: 'ceremony' };
    const tod = timeOfDay(now);
    if (tod === 'dawn') { this.candlesLit = false; return { activity: 'sweeping' }; }
    if (tod === 'dusk') { this.candlesLit = true; return { activity: 'lighting-candles' }; }
    if (tod === 'night') return { activity: 'sleeping' };
    // day: alternate idle/tending on a slow deterministic cadence (5-min blocks)
    const block = Math.floor(now.getTime() / 300_000);
    return { activity: block % 3 === 0 ? 'tending' : 'idle' };
  }
}
