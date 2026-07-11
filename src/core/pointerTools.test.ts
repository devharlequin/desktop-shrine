import { it, expect } from 'vitest';
import { classifyGesture } from './pointerTools';

const sandRect = { x: 60, y: 200, w: 300, h: 50 }; // virtual coords
it('rake inside sand, sweep over a leaf, none elsewhere', () => {
  expect(classifyGesture({ x: 100, y: 220 }, sandRect, [])).toBe('rake');
  expect(classifyGesture({ x: 30, y: 100 }, sandRect, [{ x: 31, y: 99 }])).toBe('sweep');
  expect(classifyGesture({ x: 30, y: 100 }, sandRect, [])).toBe('none');
});

it('a leaf lying on the sand sweeps rather than rakes', () => {
  expect(classifyGesture({ x: 100, y: 220 }, sandRect, [{ x: 101, y: 221 }])).toBe('sweep');
});
