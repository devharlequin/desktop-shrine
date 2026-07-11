export type ResponseId = 'bow-lingered' | 'candles-brighter' | 'incense-thick'
  | 'god-eyes-glow' | 'firefly' | 'bell';
export const RESPONSE_IDS: ResponseId[] = ['bow-lingered', 'candles-brighter',
  'incense-thick', 'god-eyes-glow', 'firefly', 'bell'];

export interface RakePoint { x: number; y: number }
export interface RakeStroke { points: RakePoint[]; t: number }
export interface Leaf { x: number; y: number; t: number; kind: number }
export interface ActiveResponse { id: ResponseId; until: number }

export interface Garden {
  version: 1;
  offeringCount: number;
  responses: ActiveResponse[];
  rakeStrokes: RakeStroke[];
  leaves: Leaf[];
  /** when the tree was planted (first launch); it grows over the weeks */
  plantedAt?: number;
}

const TREE_GROW_DAYS = 40;

/** 0..1 — how grown the tree is. Starts a sapling, full canopy after ~40 days. */
export function treeGrowth(g: Garden, now: number): number {
  if (!g.plantedAt) return 0;
  return Math.min(1, (now - g.plantedAt) / (TREE_GROW_DAYS * 86_400_000));
}

export const RAKE_FADE_DAYS = 10;
const MOMENT = 60_000; // "moment" responses linger a minute in state
const DAY = 86_400_000;

const DURATION: Record<ResponseId, number> = {
  'bow-lingered': MOMENT,
  'god-eyes-glow': MOMENT,
  'bell': MOMENT,
  'candles-brighter': DAY,
  'incense-thick': DAY,
  'firefly': 12 * 3600_000,
};

export function emptyGarden(): Garden {
  return { version: 1, offeringCount: 0, responses: [], rakeStrokes: [], leaves: [] };
}

export function recordOffering(g: Garden, now: number, responses: ResponseId[]): Garden {
  const added = responses.map(id => ({ id, until: now + DURATION[id] }));
  return { ...g, offeringCount: g.offeringCount + 1, responses: [...g.responses, ...added] };
}

export function activeResponses(g: Garden, now: number): ResponseId[] {
  return g.responses.filter(r => r.until > now).map(r => r.id);
}

export function addRakeStroke(g: Garden, s: RakeStroke): Garden {
  return { ...g, rakeStrokes: [...g.rakeStrokes, s] };
}

export function spawnLeaf(g: Garden, p: { x: number; y: number }, now: number): Garden {
  return { ...g, leaves: [...g.leaves, { ...p, t: now, kind: g.leaves.length % 3 }] };
}

export function sweepLeavesNear(g: Garden, p: { x: number; y: number }, radius: number): Garden {
  return { ...g, leaves: g.leaves.filter(l => Math.hypot(l.x - p.x, l.y - p.y) > radius) };
}

/** Drop expired responses and fully-faded rake strokes. Call occasionally. */
export function tickWeathering(g: Garden, now: number): Garden {
  return {
    ...g,
    responses: g.responses.filter(r => r.until > now),
    rakeStrokes: g.rakeStrokes.filter(s => now - s.t < RAKE_FADE_DAYS * DAY),
  };
}

/** 0..1 visual strength of a stroke as it ages. */
export function strokeStrength(s: RakeStroke, now: number): number {
  return Math.max(0, 1 - (now - s.t) / (RAKE_FADE_DAYS * DAY));
}

export function serializeGarden(g: Garden): string { return JSON.stringify(g); }

export function parseGarden(json: string | null): Garden {
  if (!json) return emptyGarden();
  try {
    const g = JSON.parse(json);
    return g?.version === 1 ? g : emptyGarden();
  } catch {
    return emptyGarden();
  }
}
