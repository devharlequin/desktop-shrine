import { describe, it, expect } from 'vitest';
import {
  emptyGarden, recordOffering, activeResponses, addRakeStroke, spawnLeaf,
  sweepLeavesNear, tickWeathering, strokeStrength, serializeGarden, parseGarden,
  treeScale,
  treeMature,
  eraseStrokesNear,
  foxTrust, foxCalmVisit, foxStartled, foxAte, setOutFood, addFoxGift,
  rollGift, FOX_TAME,
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

  it('tree grows: sapling -> full ancient size at one month, then the seasons have it', () => {
    const g = { ...emptyGarden(), plantedAt: T0 };
    const DAY = 86_400_000;
    expect(treeScale(g, T0)).toBeCloseTo(0.4, 2);
    expect(treeScale(g, T0 + 15 * DAY)).toBeCloseTo(1.25, 2);
    expect(treeScale(g, T0 + 30 * DAY)).toBeCloseTo(2.1, 2);
    expect(treeScale(g, T0 + 3650 * DAY)).toBeCloseTo(2.1, 2); // it stops, at its full height
    expect(treeScale(emptyGarden(), T0)).toBeCloseTo(0.4, 2);  // unplanted = sapling
    expect(treeMature(g, T0 + 29 * DAY)).toBe(false);
    expect(treeMature(g, T0 + 30 * DAY)).toBe(true);
    expect(treeMature(emptyGarden(), T0)).toBe(false);
  });

  it('strokes remember their tool; old saves read as the plain rake', () => {
    let g = emptyGarden();
    g = addRakeStroke(g, { points: [{ x: 270, y: 230 }, { x: 300, y: 230 }], t: T0, tool: 'wide' });
    g = addRakeStroke(g, { points: [{ x: 280, y: 240 }], t: T0, tool: 'ring' });
    const back = parseGarden(serializeGarden(g));
    expect(back.rakeStrokes[0].tool).toBe('wide');
    expect(back.rakeStrokes[1].tool).toBe('ring');
    // a stroke saved before tools existed simply has no tool field
    const old = parseGarden('{"version":1,"offeringCount":0,"responses":[],'
      + '"rakeStrokes":[{"points":[{"x":1,"y":2},{"x":3,"y":4}],"t":0}],"leaves":[]}');
    expect(old.rakeStrokes[0].tool).toBeUndefined();
  });

  it('the smoothing board erases locally, splitting strokes where it presses', () => {
    let g = emptyGarden();
    // a horizontal line through x 270..330; smooth its middle at x=300
    g = addRakeStroke(g, {
      points: [270, 280, 290, 300, 310, 320, 330].map(x => ({ x, y: 235 })), t: T0,
    });
    g = eraseStrokesNear(g, { x: 300, y: 235 }, 5);
    expect(g.rakeStrokes.length).toBe(2); // both ends stand
    expect(g.rakeStrokes[0].points.map(p => p.x)).toEqual([270, 280, 290]);
    expect(g.rakeStrokes[1].points.map(p => p.x)).toEqual([310, 320, 330]);
    // pressing most of an end flat leaves a single point — too little to keep
    g = eraseStrokesNear(g, { x: 275, y: 235 }, 6);
    expect(g.rakeStrokes.length).toBe(1);
    expect(g.rakeStrokes[0].points.map(p => p.x)).toEqual([310, 320, 330]);
  });

  it('the smoothing board lifts rings only when it reaches them', () => {
    let g = emptyGarden();
    g = addRakeStroke(g, { points: [{ x: 300, y: 235 }], t: T0, tool: 'ring' });
    g = eraseStrokesNear(g, { x: 340, y: 235 }, 4); // far away — untouched
    expect(g.rakeStrokes.length).toBe(1);
    g = eraseStrokesNear(g, { x: 305, y: 235 }, 4); // pressing the ring itself
    expect(g.rakeStrokes.length).toBe(0);
  });

  it("the fox's trust: grown slowly, dented fast, never negative", () => {
    let g = emptyGarden();
    expect(foxTrust(g)).toBe(0); // old saves have no field — a stranger's fox
    for (let i = 0; i < FOX_TAME; i++) g = foxCalmVisit(g);
    expect(foxTrust(g)).toBe(FOX_TAME);
    g = foxStartled(g);
    expect(foxTrust(g)).toBe(FOX_TAME - 2); // a fright costs two visits
    for (let i = 0; i < 40; i++) g = foxCalmVisit(g);
    expect(foxTrust(g)).toBe(12); // the reservoir has a brim
    g = foxStartled(foxStartled(g));
    for (let i = 0; i < 10; i++) g = foxStartled(g);
    expect(foxTrust(g)).toBe(0); // and a floor
    // trust survives the round trip to disk
    expect(foxTrust(parseGarden(serializeGarden(foxCalmVisit(g))))).toBe(1);
  });

  it('the dish: a morsel set out is eaten exactly once, and feeds trust', () => {
    let g = setOutFood(emptyGarden(), T0);
    expect(g.foxFoodAt).toBe(T0);
    g = foxAte(g);
    expect(g.foxFoodAt).toBeUndefined(); // the dish is empty again
    expect(foxTrust(g)).toBe(1);         // and it counted
  });

  it('gifts accumulate in the order she leaves them; the card is rare', () => {
    let g = emptyGarden();
    g = addFoxGift(g, 'coin', T0);
    g = addFoxGift(g, 'card', T0 + 1);
    const back = parseGarden(serializeGarden(g));
    expect(back.foxGifts!.map(x => x.kind)).toEqual(['coin', 'card']);
    // the roll covers every kind, and the card sits under a tenth
    expect(rollGift(() => 0.01)).toBe('card');
    expect(rollGift(() => 0.2)).toBe('coin');
    expect(rollGift(() => 0.5)).toBe('button');
    expect(rollGift(() => 0.9)).toBe('cap');
    const rate = Array.from({ length: 1000 },
      (_, i) => rollGift(() => i / 1000)).filter(k => k === 'card').length / 1000;
    expect(rate).toBeLessThan(0.1);
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
