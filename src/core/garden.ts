export type ResponseId = 'bow-lingered' | 'candles-brighter' | 'incense-thick'
  | 'god-eyes-glow' | 'firefly' | 'bell';
export const RESPONSE_IDS: ResponseId[] = ['bow-lingered', 'candles-brighter',
  'incense-thick', 'god-eyes-glow', 'firefly', 'bell'];

export interface RakePoint { x: number; y: number }
/** What drew a stroke. Old saves have no tool field — they read as 'rake'. */
export type SandTool = 'rake' | 'wide' | 'point' | 'ring';
export interface RakeStroke { points: RakePoint[]; t: number; tool?: SandTool }
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
  /** the fox's opinion of you — grown one calm visit at a time. Old saves
   *  have no field: she starts as wary as the day she first came. */
  foxTrust?: number;
  /** when a morsel was set out on the dish (absent = dish is empty) */
  foxFoodAt?: number;
  /** what she has left in return, in the order she left it */
  foxGifts?: FoxGift[];
  /** paw prints in the sand from her night crossings — their own layer,
   *  never part of rakeStrokes; shallow, so they fade fast */
  foxPrints?: FoxPrint[];
}

export interface FoxPrint { x: number; y: number; t: number }
/** Prints are shallow — gone in a few days where grooves last ten. */
export const PRINT_FADE_DAYS = 3;

export function addFoxPrint(g: Garden, p: { x: number; y: number }, now: number): Garden {
  return { ...g, foxPrints: [...(g.foxPrints ?? []), { ...p, t: now }] };
}

/** 0..1 visual depth of a print as the sand settles back. */
export function printStrength(p: FoxPrint, now: number): number {
  return Math.max(0, 1 - (now - p.t) / (PRINT_FADE_DAYS * 86_400_000));
}

/** The trove by the dish. 'card' is the rare one — for the crow. */
export type GiftKind = 'button' | 'coin' | 'cap' | 'card';
export interface FoxGift { kind: GiftKind; t: number }

/** One month from sapling to its full, ancient self. */
export const TREE_GROWTH_DAYS = 30;

/** Scale of the tree. A sapling (0.4) grows to its full, ancient size (2.1)
 *  — crown at the window's top — by the end of one month. After that it
 *  stops growing and starts answering the seasons instead. */
export function treeScale(g: Garden, now: number): number {
  if (!g.plantedAt) return 0.4;
  const days = (now - g.plantedAt) / 86_400_000;
  return 0.4 + 1.7 * Math.min(1, days / TREE_GROWTH_DAYS);
}

/** Fully grown: the month has passed; the seasons may have it now. */
export function treeMature(g: Garden, now: number): boolean {
  return !!g.plantedAt && now - g.plantedAt >= TREE_GROWTH_DAYS * 86_400_000;
}

/** Calm visits before the fox will suffer a hand: weeks, at her rhythm. */
export const FOX_TAME = 9;
const FOX_TRUST_CAP = 12; // a reservoir past tame, so one fright doesn't undo her

export function foxTrust(g: Garden): number { return g.foxTrust ?? 0; }

/** She came, sat, bowed, and left unbothered. One more stone in the wall. */
export function foxCalmVisit(g: Garden): Garden {
  return { ...g, foxTrust: Math.min(FOX_TRUST_CAP, foxTrust(g) + 1) };
}

/** She was startled. Trust is hard-won and easily dented: minus two. */
export function foxStartled(g: Garden): Garden {
  return { ...g, foxTrust: Math.max(0, foxTrust(g) - 2) };
}

/** Calm visits before she starts bringing things back. */
export const FOX_GIVES = 6;
/** How many of her gifts lie out by the dish (older ones are treasured away). */
export const GIFTS_SHOWN = 10;

export function setOutFood(g: Garden, now: number): Garden {
  return { ...g, foxFoodAt: now };
}

/** She ate. The dish empties, and a fed visit counts double toward trust
 *  — food is how a wild thing first decides about you. */
export function foxAte(g: Garden): Garden {
  const { foxFoodAt: _, ...rest } = g;
  return { ...rest, foxTrust: Math.min(FOX_TRUST_CAP, foxTrust(g) + 1) };
}

export function addFoxGift(g: Garden, kind: GiftKind, now: number): Garden {
  return { ...g, foxGifts: [...(g.foxGifts ?? []), { kind, t: now }] };
}

/** What she might bring: mostly small shiny junk; rarely, the card. */
export function rollGift(rand: () => number = Math.random): GiftKind {
  const r = rand();
  if (r < 0.06) return 'card'; // the crow's rate, roughly
  if (r < 0.40) return 'coin';
  if (r < 0.72) return 'button';
  return 'cap';
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

/** Radius the ring stamp occupies on the sand (its outer groove). */
export const RING_RADIUS = 8;

/** The smoothing board: press the sand flat near p. Strokes are split where
 *  erased, so smoothing the middle of a line leaves both ends standing. */
export function eraseStrokesNear(g: Garden, p: RakePoint, radius: number): Garden {
  const kept: RakeStroke[] = [];
  for (const s of g.rakeStrokes) {
    if (s.tool === 'ring') {
      const c = s.points[0];
      if (Math.hypot(c.x - p.x, c.y - p.y) > radius + RING_RADIUS) kept.push(s);
      continue;
    }
    let run: RakePoint[] = [];
    const flush = () => { if (run.length > 1) kept.push({ ...s, points: run }); run = []; };
    for (const q of s.points) {
      if (Math.hypot(q.x - p.x, q.y - p.y) <= radius) flush();
      else run.push(q);
    }
    flush();
  }
  // the board presses her prints flat too — sand holds no grudges
  const prints = (g.foxPrints ?? []).filter(q => Math.hypot(q.x - p.x, q.y - p.y) > radius);
  return { ...g, rakeStrokes: kept, foxPrints: prints };
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
    foxPrints: (g.foxPrints ?? []).filter(p => now - p.t < PRINT_FADE_DAYS * DAY),
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
