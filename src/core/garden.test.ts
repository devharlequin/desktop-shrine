import { describe, it, expect } from 'vitest';
import {
  emptyGarden, recordOffering, activeResponses, addRakeStroke, spawnLeaf,
  sweepLeavesNear, tickWeathering, strokeStrength, serializeGarden, parseGarden,
} from './garden';

const T0 = Date.parse('2026-07-10T12:00:00');

describe('garden', () => {
  it('records offerings and applies responses with expiry', () => {
    let g = emptyGarden();
    g = recordOffering(g, T0, ['candles-brighter', 'bow-lingered']);
    expect(g.offeringCount).toBe(1);
    expect(activeResponses(g, T0 + 1000)).toContain('candles-brighter');
    // candles-brighter lasts <= 24h; after 25h it is gone
    expect(activeResponses(g, T0 + 25 * 3600_000)).toEqual([]);
  });

  it('rake strokes persist and fade with weathering', () => {
    let g = emptyGarden();
    g = addRakeStroke(g, { points: [{ x: 10, y: 5 }, { x: 40, y: 8 }], t: T0 });
    expect(g.rakeStrokes.length).toBe(1);
    expect(strokeStrength(g.rakeStrokes[0], T0)).toBeCloseTo(1, 5);
    g = tickWeathering(g, T0 + 14 * 86_400_000); // two weeks
    expect(g.rakeStrokes.length).toBe(0); // fully faded after RAKE_FADE_DAYS
  });

  it('leaves spawn and sweep', () => {
    let g = emptyGarden();
    g = spawnLeaf(g, { x: 100, y: 200 }, T0);
    g = spawnLeaf(g, { x: 300, y: 200 }, T0);
    g = sweepLeavesNear(g, { x: 102, y: 198 }, 12);
    expect(g.leaves.length).toBe(1);
    expect(g.leaves[0].x).toBe(300);
  });

  it('serializes and parses, tolerating garbage', () => {
    let g = emptyGarden();
    g = recordOffering(g, T0, ['firefly']);
    const back = parseGarden(serializeGarden(g));
    expect(back.offeringCount).toBe(1);
    expect(parseGarden(null).offeringCount).toBe(0);
    expect(parseGarden('{not json').offeringCount).toBe(0);
    expect(parseGarden('{"version":99}').offeringCount).toBe(0);
  });
});
