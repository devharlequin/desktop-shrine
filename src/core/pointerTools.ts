export interface Rect { x: number; y: number; w: number; h: number }
export type Gesture = 'rake' | 'sweep' | 'none';

/** Near sand you rake; over leaves you sweep — leaves win so you can
 *  clear them off your pattern without ruining it. */
export function classifyGesture(
  p: { x: number; y: number },
  sand: Rect,
  leaves: { x: number; y: number }[],
  leafRadius = 8,
): Gesture {
  if (leaves.some(l => Math.hypot(l.x - p.x, l.y - p.y) <= leafRadius)) return 'sweep';
  if (p.x >= sand.x && p.x <= sand.x + sand.w && p.y >= sand.y && p.y <= sand.y + sand.h) return 'rake';
  return 'none';
}
