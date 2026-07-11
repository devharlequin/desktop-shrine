import { describe, it, expect } from 'vitest';
import { ClaudingBrain } from './clauding';

const at = (h: number, m = 0) => new Date(2026, 6, 10, h, m);

describe('ClaudingBrain', () => {
  it('follows the daily routine', () => {
    const b = new ClaudingBrain();
    expect(b.tick(at(6)).activity).toBe('sweeping');
    expect(b.tick(at(12)).activity).toMatch(/idle|tending/);
    expect(b.tick(at(18, 10)).activity).toBe('lighting-candles');
    expect(b.tick(at(23)).activity).toBe('sleeping');
  });

  it('candles end up lit after dusk tick and unlit after dawn tick', () => {
    const b = new ClaudingBrain();
    b.tick(at(18, 10));
    expect(b.candlesLit).toBe(true);
    b.tick(at(6));
    expect(b.candlesLit).toBe(false);
  });

  it('ceremony interrupt overrides routine and releases', () => {
    const b = new ClaudingBrain();
    b.beginCeremony();
    expect(b.tick(at(12)).activity).toBe('ceremony');
    b.endCeremony();
    expect(b.tick(at(12)).activity).not.toBe('ceremony');
  });
});
