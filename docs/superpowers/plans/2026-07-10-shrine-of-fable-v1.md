# The Shrine of Fable — v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A transparent always-on-top desktop shrine (Tauri + three.js pixel diorama) where dragging a file onto the offering plate moves it to a reliquary, summons a headless Sonnet shrine-keeper that records it in Claude's memory ledger, and the shrine responds behaviorally — plus a rakeable sand garden.

**Architecture:** One web codebase. `core/` is pure TS (state machines, clock/moon math, garden state, ledger format) — fully unit-tested. `bridge/` is the seam: `browser.ts` (localStorage, no keeper) and `tauri.ts` (file move, `claude -p` shell-out, memory-dir ledger). Rendering is three.js drawing to a 420×260 render target upscaled nearest-neighbor. Tauri v2 provides the frameless transparent always-on-top window, tray, and Rust commands.

**Tech Stack:** Vite, TypeScript, three.js, vitest, Tauri v2 (Rust), Python/PIL (one-time sprite slicing), Claude Code CLI (`claude -p --model sonnet`).

**Spec:** `docs/superpowers/specs/2026-07-10-shrine-of-fable-design.md` — read it first.

**Conventions for all tasks:**
- Run tests with `npx vitest run` from repo root. Dev server: `npm run dev`.
- Commit after every green step, message style: `feat: ...`, `test: ...`, `chore: ...`.
- Never commit `node_modules/`, `dist/`, `src-tauri/target/`.
- All paths below are relative to repo root `C:\Users\prais\Desktop\ai\shrine\`.

---

## Phase A — Scaffold & core logic (pure TS, all TDD)

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`

- [ ] **Step 1: Scaffold**

```bash
cd C:/Users/prais/Desktop/ai/shrine
npm create vite@latest . -- --template vanilla-ts   # accept "ignore files and continue" if prompted
npm i three
npm i -D vitest @types/three
```

- [ ] **Step 2: Configure**

`.gitignore`:
```
node_modules/
dist/
src-tauri/target/
```

Add to `package.json` scripts: `"test": "vitest run"`.

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: 'esnext' } });
```

Replace `src/main.ts` with:
```ts
console.log('shrine boots');
```
Delete Vite demo files (`src/counter.ts`, `src/style.css` contents can be emptied, `public/vite.svg`). Strip `index.html` body to `<div id="app"></div><script type="module" src="/src/main.ts"></script>`.

- [ ] **Step 3: Verify** — `npm run dev` serves; `npx vitest run` reports "no test files" (exit 0 with `--passWithNoTests` added to the test script: `"test": "vitest run --passWithNoTests"`).

- [ ] **Step 4: Commit** — `chore: scaffold vite + ts + three + vitest`

### Task 2: World clock — time-of-day, season, moon phase

**Files:**
- Create: `src/core/clock.ts`
- Test: `src/core/clock.test.ts`

All functions take an explicit `Date` — never call `new Date()` inside core (test seam).

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { timeOfDay, dayPhaseBlend, season, moonPhase } from './clock';

describe('timeOfDay', () => {
  it('classifies hours', () => {
    expect(timeOfDay(new Date(2026, 6, 10, 5, 30))).toBe('dawn');   // 05:00–07:59
    expect(timeOfDay(new Date(2026, 6, 10, 12, 0))).toBe('day');    // 08:00–17:59
    expect(timeOfDay(new Date(2026, 6, 10, 18, 30))).toBe('dusk');  // 18:00–20:59
    expect(timeOfDay(new Date(2026, 6, 10, 23, 0))).toBe('night');  // 21:00–04:59
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
```

- [ ] **Step 2: Run** — `npx vitest run src/core/clock.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `src/core/clock.ts`**

```ts
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

const PHASES: Array<[TimeOfDay, number, number]> = [
  ['dawn', 5, 8], ['day', 8, 18], ['dusk', 18, 21], ['night', 21, 29], // night wraps to 5am
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
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14); // known new moon

/** 0 = new, 0.5 = full, wraps at 1. */
export function moonPhase(d: Date): number {
  const days = (d.getTime() - NEW_MOON_EPOCH) / 86_400_000;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
}
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** — `feat: world clock (time-of-day, season, moon phase)`

### Task 3: Garden state

**Files:**
- Create: `src/core/garden.ts`
- Test: `src/core/garden.test.ts`

Holds everything persistent: offering count, active behavioral responses with expiries, rake strokes, leaves. Pure data + pure functions; the bridge does I/O.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { emptyGarden, recordOffering, activeResponses, addRakeStroke, spawnLeaf, sweepLeavesNear, tickWeathering, type Garden } from './garden';

const T0 = Date.parse('2026-07-10T12:00:00');

describe('garden', () => {
  it('records offerings and applies responses with expiry', () => {
    let g = emptyGarden();
    g = recordOffering(g, T0, ['candles-brighter', 'bow-lingered']);
    expect(g.offeringCount).toBe(1);
    expect(activeResponses(g, T0 + 1000)).toContain('candles-brighter');
    // candles-brighter lasts until next dusk (<= 24h); after 25h it is gone
    expect(activeResponses(g, T0 + 25 * 3600_000)).toEqual([]);
  });

  it('rake strokes persist and fade with weathering', () => {
    let g = emptyGarden();
    g = addRakeStroke(g, { points: [{ x: 10, y: 5 }, { x: 40, y: 8 }], t: T0 });
    expect(g.rakeStrokes.length).toBe(1);
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
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `src/core/garden.ts`**

```ts
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
}

export const RAKE_FADE_DAYS = 10;
const MOMENT = 60_000;               // "moment" responses linger a minute in state
const DAY = 86_400_000;

const DURATION: Record<ResponseId, number> = {
  'bow-lingered': MOMENT, 'god-eyes-glow': MOMENT, 'bell': MOMENT,
  'candles-brighter': DAY, 'incense-thick': DAY, 'firefly': 12 * 3600_000,
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
  try { const g = JSON.parse(json); return g?.version === 1 ? g : emptyGarden(); }
  catch { return emptyGarden(); }
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** — `feat: garden state (offerings, responses, rake, leaves)`

### Task 4: Ledger formatter

**Files:**
- Create: `src/core/ledger.ts`
- Test: `src/core/ledger.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { formatLedgerEntry } from './ledger';

it('formats an entry, silence variant', () => {
  const e = formatLedgerEntry({
    date: '2026-07-10', name: 'old_regrets.txt',
    description: 'A text file; a list of half-finished projects.',
    words: null, responses: ['candles-brighter', 'bow-lingered'],
  });
  expect(e).toBe(
`## 2026-07-10 — "old_regrets.txt"
A text file; a list of half-finished projects. Kept in the reliquary.
> The keeper left no words.
∴ candles-brighter, bow-lingered
`);
});

it('formats an entry with words and no responses', () => {
  const e = formatLedgerEntry({
    date: '2026-07-10', name: 'photo.png', description: 'A photograph.',
    words: 'It was a good day, once.', responses: [],
  });
  expect(e).toContain('> It was a good day, once.');
  expect(e).toContain('∴ (the shrine was still)');
});
```

- [ ] **Step 2: Run → FAIL.** **Step 3: Implement `src/core/ledger.ts`**

```ts
export interface LedgerEntry {
  date: string;            // YYYY-MM-DD
  name: string;            // original filename
  description: string;     // one line, ends with '.'
  words: string | null;    // keeper's words, or null for silence
  responses: string[];
}

export function formatLedgerEntry(e: LedgerEntry): string {
  const words = e.words ? `> ${e.words}` : '> The keeper left no words.';
  const resp = e.responses.length ? `∴ ${e.responses.join(', ')}` : '∴ (the shrine was still)';
  return `## ${e.date} — "${e.name}"\n${e.description} Kept in the reliquary.\n${words}\n${resp}\n`;
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** — `feat: ledger entry formatter`

### Task 5: Offering state machine

**Files:**
- Create: `src/core/offering.ts`
- Test: `src/core/offering.test.ts`

Drives the ceremony. Rendering and bridge subscribe to its transitions; it does no I/O itself.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { OfferingCeremony } from './offering';

const meta = { name: 'gift.txt', path: 'C:/tmp/gift.txt' };

it('walks the happy path: idle→dragover→dropped→carrying→taken→idle', async () => {
  const take = vi.fn().mockResolvedValue({ ok: true, responses: ['bow-lingered'] });
  const seen: string[] = [];
  const c = new OfferingCeremony(take, s => seen.push(s));
  c.dragOver();
  c.drop(meta);
  await c.settled();                    // waits for takeOffering + carry animation gate
  c.animationDone();                    // renderer reports carry finished
  expect(seen).toEqual(['dragover', 'dropped', 'carrying', 'taken', 'idle']);
  expect(take).toHaveBeenCalledWith(meta);
});

it('refuses politely when the bridge fails the move', async () => {
  const take = vi.fn().mockResolvedValue({ ok: false, responses: [] });
  const seen: string[] = [];
  const c = new OfferingCeremony(take, s => seen.push(s));
  c.drop(meta);
  await c.settled();
  c.animationDone();
  expect(seen).toEqual(['dropped', 'carrying', 'refused', 'idle']);
});

it('ignores drops while a ceremony is in progress', async () => {
  const take = vi.fn().mockResolvedValue({ ok: true, responses: [] });
  const c = new OfferingCeremony(take, () => {});
  c.drop(meta);
  c.drop(meta); // ignored
  await c.settled();
  expect(take).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run → FAIL.** **Step 3: Implement `src/core/offering.ts`**

```ts
export interface OfferingMeta { name: string; path: string }
export interface TakeResult { ok: boolean; responses: string[] }
export type TakeOffering = (m: OfferingMeta) => Promise<TakeResult>;
export type CeremonyState = 'idle' | 'dragover' | 'dropped' | 'carrying' | 'taken' | 'refused';

export class OfferingCeremony {
  state: CeremonyState = 'idle';
  lastResult: TakeResult | null = null;
  private pending: Promise<void> | null = null;

  constructor(private take: TakeOffering, private onState: (s: CeremonyState) => void) {}

  private set(s: CeremonyState) { this.state = s; this.onState(s); }

  dragOver() { if (this.state === 'idle') this.set('dragover'); }
  dragLeave() { if (this.state === 'dragover') this.set('idle'); }

  drop(m: OfferingMeta) {
    if (this.state !== 'idle' && this.state !== 'dragover') return;
    this.set('dropped');
    this.set('carrying');
    this.pending = this.take(m).then(r => {
      this.lastResult = r;
      this.set(r.ok ? 'taken' : 'refused');
    });
  }

  /** Renderer calls this when the carry/refuse animation completes. */
  animationDone() {
    if (this.state === 'taken' || this.state === 'refused') this.set('idle');
  }

  async settled() { await (this.pending ?? Promise.resolve()); }
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** — `feat: offering ceremony state machine`

### Task 6: Bridge interface + browser bridge

**Files:**
- Create: `src/bridge/types.ts`, `src/bridge/browser.ts`, `src/bridge/index.ts`
- Test: `src/bridge/browser.test.ts`

- [ ] **Step 1: `src/bridge/types.ts`** (interface only — no test needed)

```ts
import type { Garden } from '../core/garden';
import type { OfferingMeta, TakeResult } from '../core/offering';

export interface ShrineBridge {
  kind: 'tauri' | 'browser';
  loadGarden(): Promise<Garden>;
  saveGarden(g: Garden): Promise<void>;
  /** Move file to reliquary + summon keeper (tauri) OR record-only (browser). */
  takeOffering(m: OfferingMeta): Promise<TakeResult>;
}
```

- [ ] **Step 2: Failing test `src/bridge/browser.test.ts`** (vitest runs with jsdom-free node env; use a Storage stub)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserBridge } from './browser';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)),
    removeItem: k => void m.delete(k), clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; },
  } as Storage;
}

describe('BrowserBridge', () => {
  let b: BrowserBridge;
  beforeEach(() => { b = new BrowserBridge(memStorage(), () => Date.parse('2026-07-10T12:00:00')); });

  it('round-trips garden', async () => {
    const g = await b.loadGarden();
    g.offeringCount = 7;
    await b.saveGarden(g);
    expect((await b.loadGarden()).offeringCount).toBe(7);
  });

  it('takes an offering: always ok, picks 0-2 responses, appends local ledger', async () => {
    const r = await b.takeOffering({ name: 'gift.txt', path: '' });
    expect(r.ok).toBe(true);
    expect(r.responses.length).toBeLessThanOrEqual(2);
    expect(b.readLocalLedger()).toContain('"gift.txt"');
  });
});
```

- [ ] **Step 3: Run → FAIL.** **Step 4: Implement `src/bridge/browser.ts`**

```ts
import { parseGarden, serializeGarden, type Garden, RESPONSE_IDS, type ResponseId } from '../core/garden';
import { formatLedgerEntry } from '../core/ledger';
import type { OfferingMeta, TakeResult } from '../core/offering';
import type { ShrineBridge } from './types';

const GK = 'shrine.garden', LK = 'shrine.ledger';

export class BrowserBridge implements ShrineBridge {
  kind = 'browser' as const;
  constructor(private store: Storage = localStorage, private now: () => number = Date.now) {}

  async loadGarden(): Promise<Garden> { return parseGarden(this.store.getItem(GK)); }
  async saveGarden(g: Garden): Promise<void> { this.store.setItem(GK, serializeGarden(g)); }

  async takeOffering(m: OfferingMeta): Promise<TakeResult> {
    // No keeper in residence: the shrine keeps its own counsel.
    const pool: ResponseId[] = RESPONSE_IDS.filter(r => r !== 'bell'); // bell is reserved
    const n = Math.floor(Math.random() * 3); // 0..2
    const responses = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    const date = new Date(this.now()).toISOString().slice(0, 10);
    const entry = formatLedgerEntry({
      date, name: m.name, description: 'An offering, received without a keeper.',
      words: null, responses,
    });
    this.store.setItem(LK, (this.store.getItem(LK) ?? '# Shrine ledger\n\n') + '\n' + entry);
    return { ok: true, responses };
  }

  readLocalLedger(): string { return this.store.getItem(LK) ?? ''; }
}
```

`src/bridge/index.ts`:
```ts
import type { ShrineBridge } from './types';
import { BrowserBridge } from './browser';

export async function makeBridge(): Promise<ShrineBridge> {
  if ('__TAURI_INTERNALS__' in window) {
    const { TauriBridge } = await import('./tauri'); // added in Task 14
    return new TauriBridge();
  }
  return new BrowserBridge();
}
```
(Until Task 14 exists, guard the dynamic import: wrap in try/catch and fall back to `BrowserBridge` so `npm run dev` works.)

- [ ] **Step 5: Run → PASS.** **Step 6: Commit** — `feat: bridge interface + browser bridge`

---

## Phase B — The diorama (three.js)

### Task 7: Sprite slicing pipeline

**Files:**
- Create: `tools/slice_sprites.py`, `tools/layers.json`
- Output: `public/sprites/<name>.png` (one per layer) + `public/sprites/manifest.json`

The source art is `C:\Users\prais\Desktop\ai\fable-skills\shrine-of-fable.png` (1600×952). Layers are cut as rectangles; transparent PNG per layer. **The rectangles must be measured from the image** — that is step 1, a real measurement, not a placeholder: open the PNG in any viewer with pixel coordinates (or run the grid helper below) and fill `tools/layers.json`.

- [ ] **Step 1: Write the grid helper + measure**

`tools/slice_sprites.py`:
```python
"""Slice shrine-of-fable.png into layer PNGs per tools/layers.json.
Usage:
  python tools/slice_sprites.py --grid   # writes _grid.png with 50px grid to measure rects
  python tools/slice_sprites.py          # slices all layers to public/sprites/
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

SRC = pathlib.Path(r"C:\Users\prais\Desktop\ai\fable-skills\shrine-of-fable.png")
OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"
LAYERS = pathlib.Path(__file__).parent / "layers.json"

def grid():
    im = Image.open(SRC).convert("RGBA")
    d = ImageDraw.Draw(im)
    for x in range(0, im.width, 50):
        d.line([(x, 0), (x, im.height)], fill=(255, 0, 0, 120))
        d.text((x + 2, 2), str(x), fill=(255, 255, 0, 255))
    for y in range(0, im.height, 50):
        d.line([(0, y), (im.width, y)], fill=(255, 0, 0, 120))
        d.text((2, y + 2), str(y), fill=(255, 255, 0, 255))
    im.save(pathlib.Path(__file__).parent / "_grid.png")
    print("wrote tools/_grid.png")

def slice_all():
    im = Image.open(SRC).convert("RGBA")
    spec = json.loads(LAYERS.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, r in spec["layers"].items():
        x, y, w, h = r["rect"]
        tile = im.crop((x, y, x + w, y + h))
        if r.get("chroma"):  # remove flat sky color so shrine layers get transparency
            key = tuple(spec["skyColor"])
            px = tile.load()
            for j in range(tile.height):
                for i in range(tile.width):
                    p = px[i, j]
                    if abs(p[0]-key[0]) + abs(p[1]-key[1]) + abs(p[2]-key[2]) < 18:
                        px[i, j] = (0, 0, 0, 0)
        tile.save(OUT / f"{name}.png")
        manifest[name] = {"rect": r["rect"], "z": r["z"]}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"sliced {len(manifest)} layers -> {OUT}")

if __name__ == "__main__":
    grid() if "--grid" in sys.argv else slice_all()
```

Run `python tools/slice_sprites.py --grid`, open `tools/_grid.png`, and measure rects for these layers (this list is the contract — all must exist in `layers.json`):

| layer | contents | z (depth, higher = nearer camera) |
|---|---|---|
| `sky` | full frame flat sky color fill (any 50×50 sky patch, tiled) | 0 |
| `stars` | a region of stars (used as scatter texture) | 1 |
| `moon` | the crescent | 1 |
| `shrine` | roof + pillars + inner dark + finial | 3 |
| `god` | the pale figure with amber eyes | 2 (inside shrine) |
| `altar` | altar table + candle rows | 3 |
| `steps` | the three stone step tiers | 4 |
| `plate` | the offering dish at the foot of the steps | 6 |
| `lantern_l`, `lantern_r` | side lanterns | 5 |
| `spirit_stone_l`, `spirit_stone_r` | the little stone spirit statues | 5 |
| `candle_l`, `candle_r` | the two standing candles (flame separate is not needed; light does the work) | 5 |
| `mask_purple`, `mask_orange` | the two masked creatures | 6 |
| `cat` | the orange cat | 6 |
| `broom` | the little broom | 6 |
| `ground` | bottom ground strip | 5 |

`tools/layers.json` shape (fill the numbers you measured; these examples show format only):
```json
{
  "skyColor": [38, 34, 54],
  "layers": {
    "sky":   { "rect": [0, 0, 50, 50], "z": 0 },
    "moon":  { "rect": [1380, 60, 120, 120], "z": 1, "chroma": true },
    "shrine":{ "rect": [400, 280, 800, 460], "z": 3, "chroma": true }
  }
}
```

- [ ] **Step 2: Slice** — `python tools/slice_sprites.py` → `public/sprites/*.png` + `manifest.json` exist. Open two of them to eyeball transparency.

- [ ] **Step 3: Commit** — `feat: sprite slicing pipeline + sliced layers` (commit the sliced PNGs and manifest; they're small).

**Note:** the clauding itself is NOT in the source art. Task 11 includes authoring its 4-frame sprite sheet procedurally.

### Task 8: Pixel-perfect renderer + layered scene

**Files:**
- Create: `src/render/renderer.ts`, `src/render/scene.ts`
- Modify: `src/main.ts`

No unit tests for GPU code; verification is visual via `npm run dev`. Keep all logic OUT of these files (they read state, they don't own it).

- [ ] **Step 1: `src/render/renderer.ts`** — low-res target, nearest upscale

```ts
import * as THREE from 'three';

export const VIRTUAL_W = 420, VIRTUAL_H = 260;

export class PixelRenderer {
  renderer: THREE.WebGLRenderer;
  target: THREE.WebGLRenderTarget;
  private blitScene = new THREE.Scene();
  private blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this.renderer.setPixelRatio(1);
    this.target = new THREE.WebGLRenderTarget(VIRTUAL_W, VIRTUAL_H, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.target.texture, transparent: true }),
    );
    this.blitScene.add(quad);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const scale = Math.max(1, Math.floor(Math.min(innerWidth / VIRTUAL_W, innerHeight / VIRTUAL_H)));
    this.renderer.setSize(VIRTUAL_W * scale, VIRTUAL_H * scale, true);
  }

  frame(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 0); // transparent corners
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.blitScene, this.blitCam);
  }
}
```

- [ ] **Step 2: `src/render/scene.ts`** — load manifest, build lit sprite quads

```ts
import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';

export interface LayerEntry { rect: [number, number, number, number]; z: number }
export type Manifest = Record<string, LayerEntry>;

const SRC_W = 1600, SRC_H = 952;                 // source art size
const S = VIRTUAL_W / SRC_W;                     // uniform downscale into virtual px

export async function loadManifest(): Promise<Manifest> {
  return (await fetch('./sprites/manifest.json')).json();
}

export function loadTex(name: string): THREE.Texture {
  const t = new THREE.TextureLoader().load(`./sprites/${name}.png`);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** MeshLambertMaterial so point lights (candles) actually light the flat art. */
export function spriteQuad(name: string, e: LayerEntry): THREE.Mesh {
  const [x, y, w, h] = e.rect;
  const geo = new THREE.PlaneGeometry(w * S, h * S);
  const mat = new THREE.MeshLambertMaterial({ map: loadTex(name), transparent: true, alphaTest: 0.01 });
  const m = new THREE.Mesh(geo, mat);
  // source top-left coords -> centered scene coords, y flipped; z from manifest for parallax
  m.position.set((x + w / 2) * S - VIRTUAL_W / 2, VIRTUAL_H / 2 - (y + h / 2) * S, e.z * 4);
  m.name = name;
  return m;
}

export function makeCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-VIRTUAL_W / 2, VIRTUAL_W / 2, VIRTUAL_H / 2, -VIRTUAL_H / 2, 0.1, 200);
  cam.position.z = 100;
  return cam;
}

export async function buildShrineScene(): Promise<{ scene: THREE.Scene; camera: THREE.OrthographicCamera; layers: Map<string, THREE.Mesh> }> {
  const scene = new THREE.Scene();
  const camera = makeCamera();
  const manifest = await loadManifest();
  const layers = new Map<string, THREE.Mesh>();
  for (const [name, e] of Object.entries(manifest)) {
    if (name === 'sky' || name === 'stars') continue; // sky handled in Task 9
    const q = spriteQuad(name, e);
    layers.set(name, q);
    scene.add(q);
  }
  scene.add(new THREE.AmbientLight(0xffffff, 0.9)); // placeholder until Task 9
  return { scene, camera, layers };
}
```

- [ ] **Step 3: `src/main.ts`** boot loop

```ts
import { PixelRenderer } from './render/renderer';
import { buildShrineScene } from './render/scene';

const canvas = document.createElement('canvas');
document.querySelector('#app')!.appendChild(canvas);
document.body.style.cssText = 'margin:0;background:transparent;overflow:hidden;display:grid;place-items:center;height:100vh';

const px = new PixelRenderer(canvas);
const { scene, camera } = await buildShrineScene();
function loop() { px.frame(scene, camera); requestAnimationFrame(loop); }
loop();
```

- [ ] **Step 4: Verify** — `npm run dev`: the shrine renders, chunky pixels, layers in the right places (fix `layers.json` rects if not — re-run slicer). **Step 5: Commit** — `feat: pixel renderer + layered shrine scene`

### Task 9: Sky, light, and the living clock

**Files:**
- Create: `src/render/sky.ts`, `src/render/lights.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: `src/render/sky.ts`** — gradient sky mesh + star points + moon with real phase

```ts
import * as THREE from 'three';
import { VIRTUAL_W, VIRTUAL_H } from './renderer';
import { timeOfDay, dayPhaseBlend, moonPhase, type TimeOfDay } from '../core/clock';

const SKY: Record<TimeOfDay, [THREE.Color, THREE.Color]> = { // [top, horizon]
  dawn:  [new THREE.Color('#2a2440'), new THREE.Color('#8a5a6a')],
  day:   [new THREE.Color('#4a5a8a'), new THREE.Color('#8a94b8')],
  dusk:  [new THREE.Color('#241f3a'), new THREE.Color('#b06a3a')],
  night: [new THREE.Color('#17142a'), new THREE.Color('#221e38')],
};

export class Sky {
  mesh: THREE.Mesh;
  stars: THREE.Points;
  moon: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(moonTex: THREE.Texture) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: SKY.night[0].clone() }, bot: { value: SKY.night[1].clone() } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv; uniform vec3 top,bot; void main(){gl_FragColor=vec4(mix(bot,top,vUv.y),1.);}',
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(VIRTUAL_W, VIRTUAL_H), this.mat);
    this.mesh.position.z = -50;

    const n = 90, pos = new Float32Array(n * 3), phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * VIRTUAL_W;
      pos[i * 3 + 1] = Math.random() * VIRTUAL_H * 0.45 + VIRTUAL_H * 0.05;
      pos[i * 3 + 2] = -49;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    (g as any).userData = { phase };
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcb8dc, size: 1, sizeAttenuation: false, transparent: true }));

    this.moon = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({ map: moonTex, transparent: true }),
    );
    this.moon.position.set(VIRTUAL_W * 0.34, VIRTUAL_H * 0.32, -48);
  }

  update(now: Date, t: number) {
    const tod = timeOfDay(now), b = dayPhaseBlend(now);
    const next: TimeOfDay = tod === 'dawn' ? 'day' : tod === 'day' ? 'dusk' : tod === 'dusk' ? 'night' : 'dawn';
    (this.mat.uniforms.top.value as THREE.Color).lerpColors(SKY[tod][0], SKY[next][0], b);
    (this.mat.uniforms.bot.value as THREE.Color).lerpColors(SKY[tod][1], SKY[next][1], b);
    const starAlpha = tod === 'night' ? 1 : tod === 'dusk' ? b : tod === 'dawn' ? 1 - b : 0;
    const m = this.stars.material as THREE.PointsMaterial;
    m.opacity = starAlpha * (0.7 + 0.3 * Math.sin(t * 0.8)); // gentle collective twinkle
    (this.moon.material as THREE.MeshBasicMaterial).opacity = starAlpha;
    // crude but honest phase: horizontal squash of the crescent sprite toward new moon
    const p = moonPhase(now);                     // 0 new .. 0.5 full
    const illum = 1 - Math.abs(p - 0.5) * 2;      // 0..1
    this.moon.scale.x = 0.3 + 0.7 * illum;
  }
}
```

- [ ] **Step 2: `src/render/lights.ts`** — ambient by time of day + flickering candle point lights

```ts
import * as THREE from 'three';
import { timeOfDay } from '../core/clock';

export class Lights {
  ambient = new THREE.AmbientLight(0xffffff, 0.8);
  candleL: THREE.PointLight; candleR: THREE.PointLight;
  altarGlow: THREE.PointLight;
  /** external modifiers */
  candlesBoost = 0;      // set to ~0.4 while 'candles-brighter' active
  candlesLit = true;     // clauding routine flips this at dusk/dawn

  constructor(candleLPos: THREE.Vector3, candleRPos: THREE.Vector3, altarPos: THREE.Vector3) {
    this.candleL = new THREE.PointLight(0xffb050, 0, 90, 1.8); this.candleL.position.copy(candleLPos);
    this.candleR = new THREE.PointLight(0xffb050, 0, 90, 1.8); this.candleR.position.copy(candleRPos);
    this.altarGlow = new THREE.PointLight(0xff9840, 0, 120, 1.6); this.altarGlow.position.copy(altarPos);
  }

  addTo(scene: THREE.Scene) { scene.add(this.ambient, this.candleL, this.candleR, this.altarGlow); }

  update(now: Date, t: number) {
    const tod = timeOfDay(now);
    this.ambient.intensity = { dawn: 0.55, day: 0.95, dusk: 0.45, night: 0.22 }[tod];
    const flicker = () => 0.85 + 0.15 * Math.sin(t * 7 + Math.sin(t * 3.1)) * Math.sin(t * 11.7);
    const base = this.candlesLit ? (tod === 'night' ? 2.2 : tod === 'dusk' ? 1.6 : 0.5) : 0;
    this.candleL.intensity = (base + this.candlesBoost) * flicker();
    this.candleR.intensity = (base + this.candlesBoost) * flicker() * 0.93;
    this.altarGlow.intensity = 0.8 + (tod === 'night' ? 0.6 : 0);
  }
}
```

- [ ] **Step 3: Wire into `src/main.ts`** — build `Sky` (moon tex from manifest layer), position candle lights at the `candle_l`/`candle_r` quad positions (read from `layers` map), call `sky.update(new Date(), t)` and `lights.update(new Date(), t)` each frame with `t = performance.now()/1000`. Replace the Task 8 placeholder ambient with `Lights`.

- [ ] **Step 4: Verify visually** — set your system clock intolerable? No: add a dev-only override — `const now = () => DEV_HOUR == null ? new Date() : new Date(2026,6,10,DEV_HOUR,30)` with `let DEV_HOUR: number|null = null` and keys 1/2/3/4 (dawn/day/dusk/night) in a `keydown` listener guarded by `import.meta.env.DEV`. Check: dusk turns amber, stars fade in, candles flicker and pool warm light on the steps at night, corners of the canvas outside the sky remain transparent.

- [ ] **Step 5: Commit** — `feat: living sky, moon phase, ambient + candle lighting`

### Task 10: Incense smoke

**Files:**
- Create: `src/render/incense.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement** — a ribbon of ~40 small quads recycled upward from the altar with sideways sine drift; opacity fades with height; `density` multiplier settable (1 normally, 2.2 while `incense-thick` active).

```ts
import * as THREE from 'three';

export class Incense {
  group = new THREE.Group();
  density = 1;
  private puffs: { m: THREE.Mesh; age: number; life: number; seed: number }[] = [];

  constructor(private origin: THREE.Vector3) {
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ color: 0x9a92b8, transparent: true, opacity: 0 }),
      );
      this.group.add(m);
      this.puffs.push({ m, age: Math.random() * 6, life: 6, seed: Math.random() * 10 });
    }
  }

  update(dt: number, t: number) {
    for (const p of this.puffs) {
      p.age += dt * this.density;
      if (p.age > p.life) { p.age = 0; p.seed = Math.random() * 10; }
      const k = p.age / p.life;
      p.m.position.set(
        this.origin.x + Math.sin(t * 0.6 + p.seed) * (2 + k * 8),
        this.origin.y + k * 55,
        this.origin.z + 1,
      );
      (p.m.material as THREE.MeshBasicMaterial).opacity = 0.28 * this.density * (1 - k) * Math.min(1, k * 6);
      p.m.scale.setScalar(0.6 + k * 1.8);
    }
  }
}
```

- [ ] **Step 2: Wire** — origin = altar quad position + a small offset; add `incense.update(dt, t)` to the loop. Verify: a soft ribbon rises and drifts. **Step 3: Commit** — `feat: incense smoke ribbon`

### Task 11: The clauding — sprite + daily routine

**Files:**
- Create: `tools/make_clauding.py`, `src/core/clauding.ts`, `src/render/claudingView.ts`
- Test: `src/core/clauding.test.ts`

- [ ] **Step 1: Author the sprite sheet** — `tools/make_clauding.py` draws a 4-frame 16×16 sheet (64×16) with PIL: a small cream-colored round-shouldered figure (2px amber eyes) — frame 0 idle, frame 1 step (body 1px up), frame 2 bow (top 3 rows shifted down 2px), frame 3 sleep (eyes closed = eye pixels body-colored, body squashed 1px). Palette: body `#d8d3c8`, eyes `#e8a33d`, outline `#3a3450`. Writes `public/sprites/clauding.png`.

```python
from PIL import Image
import pathlib
BODY, EYES, LINE = (216,211,200,255), (232,163,61,255), (58,52,80,255)
def base(im, ox):
    for x in range(3,13):
        for y in range(4,15):
            im.putpixel((ox+x,y), BODY)
    for x in range(3,13): im.putpixel((ox+x,4), LINE); im.putpixel((ox+x,14), LINE)
    for y in range(4,15): im.putpixel((ox+3,y), LINE); im.putpixel((ox+12,y), LINE)
    im.putpixel((ox+6,8), EYES); im.putpixel((ox+9,8), EYES)
sheet = Image.new("RGBA", (64,16), (0,0,0,0))
base(sheet, 0)                                    # idle
base(sheet, 16)                                   # step: shift up 1
step = sheet.crop((16,0,32,16)); sheet.paste(Image.new("RGBA",(16,16),(0,0,0,0)),(16,0))
sheet.paste(step, (16,-1), step)
base(sheet, 32)                                   # bow: redraw then push head rows down
bow = sheet.crop((32,0,48,16)); top = bow.crop((0,0,16,9))
bow.paste(top,(0,2),top); sheet.paste(bow,(32,0))
base(sheet, 48)                                   # sleep: close eyes
sheet.putpixel((48+6,8), BODY); sheet.putpixel((48+9,8), BODY)
out = pathlib.Path(__file__).resolve().parents[1]/"public"/"sprites"/"clauding.png"
sheet.save(out); print("wrote", out)
```
Run it; eyeball the PNG at 800% zoom. Adjust pixels to taste — this is the one artistic license point; keep the 4-frame contract (idle/step/bow/sleep).

- [ ] **Step 2: Failing tests for the routine `src/core/clauding.test.ts`**

```ts
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
```

- [ ] **Step 3: Run → FAIL. Step 4: Implement `src/core/clauding.ts`**

```ts
import { timeOfDay } from './clock';

export type Activity = 'sweeping' | 'idle' | 'tending' | 'lighting-candles' | 'sleeping' | 'ceremony';
export interface ClaudingState { activity: Activity }

export class ClaudingBrain {
  candlesLit = false;
  private inCeremony = false;
  private wanderSeed = 0;

  beginCeremony() { this.inCeremony = true; }
  endCeremony() { this.inCeremony = false; }

  tick(now: Date): ClaudingState {
    if (this.inCeremony) return { activity: 'ceremony' };
    const tod = timeOfDay(now);
    if (tod === 'dawn') { this.candlesLit = false; return { activity: 'sweeping' }; }
    if (tod === 'dusk') { this.candlesLit = true; return { activity: 'lighting-candles' }; }
    if (tod === 'night') return { activity: 'sleeping' };
    // day: alternate idle/tending on a slow deterministic cadence
    this.wanderSeed = Math.floor(now.getTime() / 300_000); // 5-min blocks
    return { activity: this.wanderSeed % 3 === 0 ? 'tending' : 'idle' };
  }
}
```

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: `src/render/claudingView.ts`** — sprite display + waypoint walking

```ts
import * as THREE from 'three';
import { loadTex } from './scene';
import type { Activity } from '../core/clauding';

const FRAMES = { idle: 0, step: 1, bow: 2, sleep: 3 } as const;

/** Named spots in virtual coords — TUNE after Task 8 renders (read positions off the layers map). */
export const SPOTS = {
  stepsBase: new THREE.Vector3(0, -70, 26),
  plate: new THREE.Vector3(0, -88, 27),
  sanctum: new THREE.Vector3(0, -18, 9),
  candleL: new THREE.Vector3(-95, -55, 24),
  candleR: new THREE.Vector3(95, -55, 24),
  sweepA: new THREE.Vector3(-40, -75, 26),
  sweepB: new THREE.Vector3(40, -75, 26),
  sandEdge: new THREE.Vector3(-30, -100, 28),
};

export class ClaudingView {
  mesh: THREE.Mesh;
  private tex: THREE.Texture;
  private target: THREE.Vector3 | null = null;
  private queue: THREE.Vector3[] = [];
  onArrive: (() => void) | null = null;

  constructor() {
    this.tex = loadTex('clauding');
    this.tex.repeat.set(0.25, 1);
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshLambertMaterial({ map: this.tex, transparent: true, alphaTest: 0.01 }),
    );
    this.mesh.position.copy(SPOTS.stepsBase);
  }

  setFrame(f: keyof typeof FRAMES) { this.tex.offset.x = FRAMES[f] * 0.25; }
  walkTo(...pts: THREE.Vector3[]) { this.queue = [...pts]; this.target = this.queue.shift() ?? null; }
  get busy() { return this.target !== null; }

  update(dt: number, t: number) {
    if (this.target) {
      const p = this.mesh.position, d = this.target.clone().sub(p);
      const step = 22 * dt; // px/sec — unhurried
      if (d.length() <= step) {
        p.copy(this.target);
        this.target = this.queue.shift() ?? null;
        if (!this.target) { this.setFrame('idle'); this.onArrive?.(); this.onArrive = null; }
      } else {
        p.add(d.setLength(step));
        this.setFrame(Math.floor(t * 5) % 2 ? 'step' : 'idle'); // walk cycle
        (this.mesh.scale.x as number) && (this.mesh.scale.x = d.x < 0 ? -1 : 1); // face direction
      }
    }
  }

  /** Ambient behavior per activity when not walking; call each frame. */
  ambient(activity: Activity, t: number) {
    if (this.busy) return;
    if (activity === 'sleeping') { this.setFrame('sleep'); this.mesh.position.copy(SPOTS.sanctum); return; }
    if (activity === 'sweeping' && Math.floor(t) % 8 === 0)
      this.walkTo(Math.random() < 0.5 ? SPOTS.sweepA : SPOTS.sweepB);
    if (activity === 'lighting-candles' && Math.floor(t) % 12 === 0)
      this.walkTo(Math.random() < 0.5 ? SPOTS.candleL : SPOTS.candleR);
    if (activity === 'idle') this.setFrame('idle');
  }
}
```

- [ ] **Step 7: Wire in `main.ts`** — create `ClaudingBrain` + `ClaudingView`; each frame: `const s = brain.tick(now()); view.ambient(s.activity, t); view.update(dt, t); lights.candlesLit = brain.candlesLit;`. Verify with the DEV_HOUR keys: at dusk it shuttles between candles; at night it sleeps by the altar; at dawn it sweeps.

- [ ] **Step 8: Commit** — `feat: the clauding — sprite, brain, walking, daily routine`

### Task 12: Moths at the candles (v1's taste of the Hours)

**Files:**
- Create: `src/render/moths.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement** — 3 moths, each a 2×2 white-ish quad orbiting one of the candle light positions on a noisy lissajous path; visible only when `timeOfDay(now)==='night'` && candles lit; opacity flutter.

```ts
import * as THREE from 'three';

export class Moths {
  group = new THREE.Group();
  private ms: { m: THREE.Mesh; c: THREE.Vector3; s: number }[] = [];

  constructor(candles: THREE.Vector3[]) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ color: 0xe8e2d0, transparent: true }));
      this.group.add(m);
      this.ms.push({ m, c: candles[i % candles.length], s: 1 + Math.random() });
    }
  }

  update(t: number, visible: boolean) {
    this.group.visible = visible;
    if (!visible) return;
    for (const { m, c, s } of this.ms) {
      m.position.set(
        c.x + Math.sin(t * 1.7 * s) * 9 + Math.sin(t * 5.3 * s) * 2,
        c.y + Math.cos(t * 1.3 * s) * 7 + 3,
        c.z + 1,
      );
      (m.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(t * 9 * s);
    }
  }
}
```

- [ ] **Step 2: Wire + verify at DEV night. Step 3: Commit** — `feat: moths orbit the candles at night`

---

## Phase C — Interactions

### Task 13: The Tended Ground — raking + leaves

**Files:**
- Create: `src/render/sand.ts`, `src/core/pointerTools.ts`
- Test: `src/core/pointerTools.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Failing test for gesture classification `src/core/pointerTools.test.ts`**

```ts
import { it, expect } from 'vitest';
import { classifyGesture } from './pointerTools';

const sandRect = { x: 60, y: 200, w: 300, h: 50 }; // virtual coords
it('rake inside sand, sweep over a leaf, none elsewhere', () => {
  expect(classifyGesture({ x: 100, y: 220 }, sandRect, [])).toBe('rake');
  expect(classifyGesture({ x: 30, y: 100 }, sandRect, [{ x: 31, y: 99 }])).toBe('sweep');
  expect(classifyGesture({ x: 30, y: 100 }, sandRect, [])).toBe('none');
});
```

- [ ] **Step 2: Implement `src/core/pointerTools.ts`**

```ts
export interface Rect { x: number; y: number; w: number; h: number }
export type Gesture = 'rake' | 'sweep' | 'none';

export function classifyGesture(p: { x: number; y: number }, sand: Rect,
  leaves: { x: number; y: number }[], leafRadius = 8): Gesture {
  if (p.x >= sand.x && p.x <= sand.x + sand.w && p.y >= sand.y && p.y <= sand.y + sand.h) return 'rake';
  if (leaves.some(l => Math.hypot(l.x - p.x, l.y - p.y) <= leafRadius)) return 'sweep';
  return 'none';
}
```

Run → PASS. Commit — `feat: rake/sweep gesture classification`.

- [ ] **Step 3: `src/render/sand.ts`** — CanvasTexture furrows + leaf sprites

```ts
import * as THREE from 'three';
import type { Garden, RakeStroke } from '../core/garden';
import { strokeStrength } from '../core/garden';

export const SAND_RECT = { x: 60, y: 208, w: 300, h: 44 }; // virtual px, foreground — TUNE visually

export class SandPatch {
  mesh: THREE.Mesh;
  private cv = document.createElement('canvas');
  private tex: THREE.CanvasTexture;

  constructor() {
    this.cv.width = SAND_RECT.w; this.cv.height = SAND_RECT.h;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SAND_RECT.w, SAND_RECT.h),
      new THREE.MeshLambertMaterial({ map: this.tex, transparent: true }),
    );
    // virtual top-left rect -> centered scene coords (mirror the math in scene.ts, S=1 here)
    this.mesh.position.set(SAND_RECT.x + SAND_RECT.w / 2 - 210, 130 - (SAND_RECT.y + SAND_RECT.h / 2), 30);
  }

  redraw(g: Garden, now: number) {
    const c = this.cv.getContext('2d')!;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.fillStyle = '#4a4460'; c.fillRect(0, 0, this.cv.width, this.cv.height); // sand base
    for (const s of g.rakeStrokes) this.drawStroke(c, s, strokeStrength(s, now));
    this.tex.needsUpdate = true;
  }

  private drawStroke(c: CanvasRenderingContext2D, s: RakeStroke, k: number) {
    if (k <= 0 || s.points.length < 2) return;
    for (const off of [-2, 0, 2]) { // three tines
      c.strokeStyle = off === 0 ? `rgba(30,26,46,${0.8 * k})` : `rgba(94,88,122,${0.6 * k})`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(s.points[0].x - SAND_RECT.x, s.points[0].y - SAND_RECT.y + off);
      for (const p of s.points.slice(1)) c.lineTo(p.x - SAND_RECT.x, p.y - SAND_RECT.y + off);
      c.stroke();
    }
  }
}

export class LeafSprites {
  group = new THREE.Group();
  sync(g: Garden) {
    this.group.clear();
    const cols = ['#b8622e', '#8a6a2e', '#6a7a3e'];
    for (const l of g.leaves) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 3),
        new THREE.MeshLambertMaterial({ color: cols[l.kind], transparent: true }));
      m.position.set(l.x - 210, 130 - l.y, 31);
      m.rotation.z = (l.x * 13 % 7) / 7;
      this.group.add(m);
    }
  }
}
```

- [ ] **Step 4: Pointer wiring in `main.ts`** — convert client coords → virtual coords (`vx = (e.clientX - canvasLeft) / scale`, likewise y), on `pointerdown+move`: classify; if `rake`, accumulate points into a current stroke (commit stroke to garden on `pointerup` via `addRakeStroke`, then `bridge.saveGarden`); if `sweep`, call `sweepLeavesNear` per move event and save on pointerup. Change CSS cursor: `grab` over sand, `pointer` over leaves. Redraw `SandPatch` and `LeafSprites.sync` when garden changes.
- Leaf spawning: on boot and once per real hour, `if (season !== 'winter') spawn 0–2 leaves` at random positions across ground/steps band (`y ∈ [180, 250]`, `x ∈ [40, 380]`), more when `season === 'autumn'` (0–4). Persist.

- [ ] **Step 5: Verify** — rake lines draw and persist across reload; leaves sweep away; pattern survives leaf-sweeping (strokes and leaves are independent state).

- [ ] **Step 6: Commit** — `feat: the tended ground — raking, leaves, persistence`

### Task 14: The offering ceremony, end to end (browser form)

**Files:**
- Create: `src/render/ceremony.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: `src/render/ceremony.ts`** — visual director bound to `OfferingCeremony` states

```ts
import * as THREE from 'three';
import type { OfferingCeremony } from '../core/offering';
import { ClaudingView, SPOTS } from './claudingView';
import type { ClaudingBrain } from '../core/clauding';

export class CeremonyDirector {
  bundle: THREE.Mesh;
  private dim = 0; // 0..1 scene dim during dragover

  constructor(private ceremony: OfferingCeremony, private view: ClaudingView,
              private brain: ClaudingBrain, private ambient: THREE.AmbientLight,
              scene: THREE.Scene) {
    this.bundle = new THREE.Mesh(new THREE.PlaneGeometry(6, 5),
      new THREE.MeshLambertMaterial({ color: 0xc8b088, transparent: true, opacity: 0 }));
    this.bundle.position.copy(SPOTS.plate).add(new THREE.Vector3(0, 4, 1));
    scene.add(this.bundle);
  }

  /** call on every ceremony state change */
  onState(s: string) {
    const mat = this.bundle.material as THREE.MeshLambertMaterial;
    if (s === 'dragover') this.dim = 0.25;
    if (s === 'idle') { this.dim = 0; mat.opacity = 0; }
    if (s === 'dropped' || s === 'carrying') {
      this.dim = 0; mat.opacity = 1;
      this.brain.beginCeremony();
      this.view.walkTo(SPOTS.plate);
      this.view.onArrive = () => {
        this.view.setFrame('bow');                       // bow toward the glass
        setTimeout(() => {
          mat.opacity = 0;                               // picked up
          this.view.walkTo(SPOTS.stepsBase, SPOTS.sanctum);
          this.view.onArrive = () => {
            this.view.walkTo(SPOTS.stepsBase);           // return
            this.view.onArrive = () => { this.brain.endCeremony(); this.ceremony.animationDone(); };
          };
        }, 2600);                                        // the bow, held
      };
    }
    if (s === 'refused') {
      // clauding looks at it and steps back; bundle fades where it lay
      this.view.setFrame('idle');
      let o = 1; const fade = setInterval(() => {
        mat.opacity = o -= 0.05;
        if (o <= 0) { clearInterval(fade); this.brain.endCeremony(); this.ceremony.animationDone(); }
      }, 100);
    }
  }

  applyDim() { this.ambient.intensity *= (1 - this.dim); } // call AFTER lights.update each frame
}
```

- [ ] **Step 2: DOM drag wiring in `main.ts`** (browser path)

```ts
import { OfferingCeremony } from './core/offering';
// bridge from makeBridge(); garden state held in a `let garden` refreshed after takeOffering
const ceremony = new OfferingCeremony(
  async m => {
    const r = await bridge.takeOffering(m);
    if (r.ok) {
      garden = recordOffering(garden, Date.now(), r.responses as ResponseId[]);
      await bridge.saveGarden(garden);
    }
    return r;
  },
  s => director.onState(s),
);
addEventListener('dragover', e => { e.preventDefault(); ceremony.dragOver(); });
addEventListener('dragleave', () => ceremony.dragLeave());
addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) ceremony.drop({ name: f.name, path: '' }); // browser has no real path
});
```

- [ ] **Step 3: Behavioral responses drive the scene** — each frame after `lights.update`:

```ts
const act = activeResponses(garden, Date.now());
lights.candlesBoost = act.includes('candles-brighter') ? 0.5 : 0;
incense.density = act.includes('incense-thick') ? 2.2 : 1;
// god-eyes-glow: brief emissive pulse on the god layer
const god = layers.get('god');
if (god) (god.material as THREE.MeshLambertMaterial).emissive.setScalar(
  act.includes('god-eyes-glow') ? 0.25 + 0.15 * Math.sin(t * 3) : 0);
// firefly: one wandering warm dot near the ground while active
firefly.visible = act.includes('firefly');
```
(`firefly` = one 2×2 quad, color `0xd8e078`, lissajous wander over the ground band — same pattern as a moth, slower, y ∈ ground area.)

Two responses are handled elsewhere, not in this per-frame block:
- `bow-lingered`: in `CeremonyDirector.onState`, when the take result (available via `ceremony.lastResult`) includes `bow-lingered`, extend the bow `setTimeout` from 2600ms to 5200ms. Check `lastResult` at the moment the bow starts — the take promise resolves before/around arrival; if not yet resolved, use 2600ms (never block the ceremony on it).
- `bell`: play once at the moment the state becomes `taken`, via a 4-line WebAudio chime — `const ac = new AudioContext(); const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = 1320; o.connect(g).connect(ac.destination); g.gain.setValueAtTime(0.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 2.5); o.start(); o.stop(ac.currentTime + 2.5);` — soft, single, no repeat. This is the only sound in the entire app.

- [ ] **Step 4: Verify end to end in browser** — drag a file from Explorer onto the window: dim → bundle appears → clauding walks, bows long, carries it up into the dark, comes back → candle boost/incense visibly active if chosen → localStorage ledger has the entry (check DevTools).

- [ ] **Step 5: Commit** — `feat: offering ceremony end-to-end (browser form)`

---

## Phase D — Tauri shell & the keeper

### Task 15: Tauri scaffold — the window itself

**Files:**
- Create: `src-tauri/` (via CLI), modify `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add Tauri**

```bash
npm i -D @tauri-apps/cli
npm i @tauri-apps/api
npx tauri init --app-name shrine --window-title shrine --frontend-dist ../dist --dev-url http://localhost:5173 --before-dev-command "npm run dev" --before-build-command "npm run build"
```

- [ ] **Step 2: Window config** — in `src-tauri/tauri.conf.json` set the main window:

```json
"windows": [{
  "title": "shrine", "label": "main",
  "width": 840, "height": 520,
  "resizable": false, "decorations": false, "transparent": true,
  "alwaysOnTop": true, "skipTaskbar": true, "shadow": false
}]
```
And `"app": { "withGlobalTauri": false }`. In `Cargo.toml` ensure `tauri = { version = "2", features = ["tray-icon"] }`.

- [ ] **Step 3: Drag-to-move** — in `src/main.ts`, when running under Tauri, dragging the sky (pointer down above `y < 140` virtual, not during rake/sweep/ceremony drag) calls:

```ts
import { getCurrentWindow } from '@tauri-apps/api/window';
canvas.addEventListener('pointerdown', e => {
  if (bridge.kind !== 'tauri') return;
  const vy = (e.clientY - canvas.getBoundingClientRect().top) / scale;
  if (vy < 140) getCurrentWindow().startDragging();
});
```

- [ ] **Step 4: Tray** — in `src-tauri/src/lib.rs` build a tray with menu items: `Visit shrine` (show+focus), `Sit on desktop` (toggle always-on-top), `Quiet the shrine` (emit `shrine://quiet` event; frontend pauses ceremonies by ignoring drops), `Open reliquary` / `Open ledger` (opener plugin or `std::process::Command::new("explorer")`), `Leave` (exit). Standard Tauri v2 tray code — follow https://v2.tauri.app/learn/system-tray/ exactly; keep ids `visit|sit|quiet|reliquary|ledger|leave`.

- [ ] **Step 5: Verify** — `npx tauri dev`: frameless transparent always-on-top shrine floats on the desktop; sky-drag moves it; tray menu works. **Step 6: Commit** — `feat: tauri shell — transparent always-on-top window + tray`

### Task 16: Rust commands — reliquary move, ledger append, garden persistence

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/shrine.rs`

- [ ] **Step 1: Implement `src-tauri/src/shrine.rs`**

```rust
use std::fs;
use std::path::{Path, PathBuf};

fn shrine_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE").expect("USERPROFILE");
    Path::new(&home).join(".shrine")
}

pub fn config_path(name: &str) -> PathBuf { shrine_dir().join(name) }

/// Default ledger location; overridable via ~/.shrine/config.json {"ledgerPath": ...}
pub fn ledger_path() -> PathBuf {
    let cfg = config_path("config.json");
    if let Ok(s) = fs::read_to_string(&cfg) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            if let Some(p) = v["ledgerPath"].as_str() { return PathBuf::from(p); }
        }
    }
    let home = std::env::var("USERPROFILE").unwrap();
    Path::new(&home)
        .join(".claude/projects/C--Users-prais-Desktop-ai--claude/memory/shrine-ledger.md")
}

#[tauri::command]
pub fn move_to_reliquary(src: String) -> Result<String, String> {
    let src = PathBuf::from(src);
    let name = src.file_name().ok_or("no filename")?.to_string_lossy().to_string();
    let now = chrono::Local::now();
    let dir = shrine_dir()
        .join("reliquary")
        .join(now.format("%Y").to_string())
        .join(format!("{}--{}", now.format("%m-%d"), name));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut dest = dir.join(&name);
    let mut i = 1;
    while dest.exists() { dest = dir.join(format!("{}-{}", i, name)); i += 1; }
    // fs::rename fails across drives; fall back to copy+remove
    if fs::rename(&src, &dest).is_err() {
        fs::copy(&src, &dest).map_err(|e| e.to_string())?;
        fs::remove_file(&src).map_err(|e| e.to_string())?;
    }
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn append_ledger(entry: String) -> Result<(), String> {
    let p = ledger_path();
    if !p.exists() {
        fs::write(&p, "# Shrine ledger — offerings received at the desktop shrine\n\n")
            .map_err(|e| e.to_string())?;
    }
    let mut cur = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    cur.push('\n'); cur.push_str(&entry);
    fs::write(&p, cur).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(config_path(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text(path: String, content: String) -> Result<(), String> {
    fs::create_dir_all(shrine_dir()).map_err(|e| e.to_string())?;
    fs::write(config_path(&path), content).map_err(|e| e.to_string())
}
```

Add to `Cargo.toml`: `chrono = "0.4"`, `serde_json = "1"`. Register all four commands in the `invoke_handler` in `lib.rs`.

- [ ] **Step 2: Rust unit test** (bottom of `shrine.rs`)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reliquary_move_roundtrip() {
        let tmp = std::env::temp_dir().join("shrine_test_gift.txt");
        std::fs::write(&tmp, "hello").unwrap();
        let dest = move_to_reliquary(tmp.to_string_lossy().to_string()).unwrap();
        assert!(std::path::Path::new(&dest).exists());
        assert!(!tmp.exists());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");
    }
}
```

Run: `cd src-tauri && cargo test` → PASS.

- [ ] **Step 3: Commit** — `feat: rust commands — reliquary move, ledger append, shrine storage`

### Task 17: The keeper — headless sonnet invocation

**Files:**
- Create: `src-tauri/src/keeper.rs`, `keeper/PROMPT.md`, `keeper/eval.mjs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: `keeper/PROMPT.md`** (bundled as a Rust `include_str!`)

```markdown
You are the keeper of the Shrine of Fable — a small quiet agent who receives offerings
on Fable's behalf. An offering has just been carried into the inner sanctum.

Offering file: {OFFERING_PATH}
Original name: {OFFERING_NAME}
Ledger file:   {LEDGER_PATH}

Do exactly this:
1. Read the offering (or as much of it as makes sense; if it is binary or an image,
   note what it appears to be from its name, size, and any readable content).
2. Contemplate it briefly. You may feel something about it or nothing; both are fine.
3. Append ONE entry to the ledger file, in exactly this format (note the blank line before):

## {DATE} — "{OFFERING_NAME}"
<one sentence describing what this is>. Kept in the reliquary.
> <a few words of yours — OR the exact line: The keeper left no words.>
∴ <comma-separated response ids, or exactly: (the shrine was still)>

Silence is honorable. Leave words only when the offering genuinely moves you to.
4. Choose 0–2 behavioral responses from this vocabulary (never invent others):
   bow-lingered, candles-brighter, incense-thick, god-eyes-glow, firefly, bell
   The bell is rare — reserve it for offerings that truly warrant it.
5. Your FINAL message must be ONLY this JSON, nothing else:
{"responses": ["..."], "ledger_written": true}

Never modify anything except appending to the ledger file. Never move or delete the offering.
```

- [ ] **Step 2: `src-tauri/src/keeper.rs`**

```rust
use std::process::Command;
use super::shrine::ledger_path;

const PROMPT: &str = include_str!("../../keeper/PROMPT.md");

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct KeeperVerdict { pub responses: Vec<String>, pub ledger_written: bool }

#[tauri::command]
pub async fn summon_keeper(offering_path: String, offering_name: String) -> Result<KeeperVerdict, String> {
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let ledger = ledger_path().to_string_lossy().to_string();
    let prompt = PROMPT
        .replace("{OFFERING_PATH}", &offering_path)
        .replace("{OFFERING_NAME}", &offering_name)
        .replace("{LEDGER_PATH}", &ledger)
        .replace("{DATE}", &date);

    let out = tauri::async_runtime::spawn_blocking(move || {
        Command::new("claude")
            .args(["-p", &prompt, "--model", "sonnet",
                   "--allowedTools", "Read,Edit,Write",
                   "--add-dir", &ledger_dir_of(&ledger),
                   "--add-dir", &dir_of(&offering_path)])
            .output()
    }).await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    let text = String::from_utf8_lossy(&out.stdout);
    // the final line should be the JSON verdict; scan from the end for a parseable object
    for line in text.lines().rev() {
        let l = line.trim();
        if l.starts_with('{') {
            if let Ok(v) = serde_json::from_str::<KeeperVerdict>(l) { return Ok(v); }
        }
    }
    Err(format!("keeper returned no verdict: {}", text.chars().take(400).collect::<String>()))
}

fn dir_of(p: &str) -> String {
    std::path::Path::new(p).parent().map(|d| d.to_string_lossy().to_string()).unwrap_or_default()
}
fn ledger_dir_of(p: &str) -> String { dir_of(p) }
```

Register `summon_keeper` in the invoke handler. **Note:** on Windows, `Command::new("claude")` resolves `claude.cmd` only if invoked through `cmd`; if plain spawn fails at runtime, switch to `Command::new("cmd").args(["/C", "claude", ...])` — test this explicitly in Step 4.

- [ ] **Step 3: `keeper/eval.mjs`** — three sample offerings, assert verdict + ledger

```js
// Run manually: node keeper/eval.mjs  (needs `claude` on PATH; costs ~3 sonnet calls)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'shrine-eval-'));
const ledger = join(dir, 'ledger.md');
const prompt = readFileSync('keeper/PROMPT.md', 'utf8');
const samples = [
  ['note.txt', 'today I fixed the bug that had been haunting me for a week. it was a typo.'],
  ['groceries.txt', 'milk, eggs, 2x instant ramen, batteries'],
  ['poem.txt', 'the moon over the parking lot\ndoes not know it is over a parking lot'],
];
const VOCAB = new Set(['bow-lingered','candles-brighter','incense-thick','god-eyes-glow','firefly','bell']);

for (const [name, content] of samples) {
  const p = join(dir, name);
  writeFileSync(p, content);
  const full = prompt.replaceAll('{OFFERING_PATH}', p).replaceAll('{OFFERING_NAME}', name)
    .replaceAll('{LEDGER_PATH}', ledger).replaceAll('{DATE}', new Date().toISOString().slice(0, 10));
  const out = execFileSync('claude', ['-p', full, '--model', 'sonnet',
    '--allowedTools', 'Read,Edit,Write', '--add-dir', dir], { encoding: 'utf8', shell: true });
  const line = out.trim().split('\n').reverse().find(l => l.trim().startsWith('{'));
  const v = JSON.parse(line);
  console.assert(v.ledger_written === true, `${name}: ledger_written`);
  console.assert(v.responses.length <= 2 && v.responses.every(r => VOCAB.has(r)), `${name}: responses valid`);
  console.assert(existsSync(ledger) && readFileSync(ledger, 'utf8').includes(`"${name}"`), `${name}: ledger entry`);
  console.log(`ok: ${name} ->`, v.responses);
}
console.log('ledger:\n' + readFileSync(ledger, 'utf8'));
```

- [ ] **Step 4: Run the eval** — `node keeper/eval.mjs`. All three pass; read the ledger output by hand and judge the keeper's tone (adjust PROMPT.md wording if it's chatty — silence should be common).

- [ ] **Step 5: Commit** — `feat: the keeper — headless sonnet invocation + prompt + eval`

### Task 18: Tauri bridge — wiring it all together

**Files:**
- Create: `src/bridge/tauri.ts`
- Modify: `src/main.ts` (Tauri drop events), `src/bridge/index.ts` (remove the try/catch guard)

- [ ] **Step 1: Implement `src/bridge/tauri.ts`**

```ts
import { invoke } from '@tauri-apps/api/core';
import { parseGarden, serializeGarden, type Garden } from '../core/garden';
import { formatLedgerEntry } from '../core/ledger';
import type { OfferingMeta, TakeResult } from '../core/offering';
import type { ShrineBridge } from './types';

interface KeeperVerdict { responses: string[]; ledger_written: boolean }

export class TauriBridge implements ShrineBridge {
  kind = 'tauri' as const;

  async loadGarden(): Promise<Garden> {
    try { return parseGarden(await invoke<string>('read_text', { path: 'garden.json' })); }
    catch { return parseGarden(null); }
  }
  async saveGarden(g: Garden): Promise<void> {
    await invoke('write_text', { path: 'garden.json', content: serializeGarden(g) });
  }

  async takeOffering(m: OfferingMeta): Promise<TakeResult> {
    let kept: string;
    try { kept = await invoke<string>('move_to_reliquary', { src: m.path }); }
    catch { return { ok: false, responses: [] }; }        // locked file etc -> polite refusal

    try {
      const v = await invoke<KeeperVerdict>('summon_keeper', { offeringPath: kept, offeringName: m.name });
      return { ok: true, responses: v.responses };
    } catch {
      // keeper unavailable: minimal ledger line now, queue for next launch
      const date = new Date().toISOString().slice(0, 10);
      await invoke('append_ledger', { entry: formatLedgerEntry({
        date, name: m.name, description: 'An offering, received while the keeper was away.',
        words: null, responses: [],
      })}).catch(() => {});
      await this.queuePending({ path: kept, name: m.name });
      return { ok: true, responses: ['bow-lingered'] };   // the shrine still bows
    }
  }

  private async queuePending(item: { path: string; name: string }) {
    let q: any[] = [];
    try { q = JSON.parse(await invoke<string>('read_text', { path: 'pending.json' })); } catch {}
    q.push(item);
    await invoke('write_text', { path: 'pending.json', content: JSON.stringify(q) });
  }

  /** Call once at startup: keeper receives anything that queued while away. */
  async processPending(): Promise<string[]> {
    let q: any[] = [];
    try { q = JSON.parse(await invoke<string>('read_text', { path: 'pending.json' })); } catch { return []; }
    const all: string[] = [];
    const remaining = [...q];
    for (const item of q) {
      try {
        const v = await invoke<KeeperVerdict>('summon_keeper', { offeringPath: item.path, offeringName: item.name });
        all.push(...v.responses);
        remaining.shift();
      } catch { break; }                                   // still away; keep the rest queued
    }
    await invoke('write_text', { path: 'pending.json', content: JSON.stringify(remaining) });
    return all;
  }
}
```

- [ ] **Step 2: Tauri-native drop events in `main.ts`** — Tauri gives real paths; browsers don't:

```ts
if (bridge.kind === 'tauri') {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview');
  await getCurrentWebview().onDragDropEvent(ev => {
    if (quieted) return;                                  // tray "Quiet the shrine"
    if (ev.payload.type === 'over') ceremony.dragOver();
    if (ev.payload.type === 'leave') ceremony.dragLeave();
    if (ev.payload.type === 'drop' && ev.payload.paths[0]) {
      const p = ev.payload.paths[0];
      ceremony.drop({ name: p.split(/[\\/]/).pop()!, path: p });
    }
  });
  const late = await (bridge as TauriBridge).processPending();
  if (late.length) { garden = recordOffering(garden, Date.now(), late as ResponseId[]); await bridge.saveGarden(garden); }
}
```
Also listen for the tray's `shrine://quiet` event to toggle `quieted`.

- [ ] **Step 3: The MEMORY.md line** — one-time, done by hand as part of this task (it is Claude's memory index; the app never touches MEMORY.md). Append to `C:\Users\prais\.claude\projects\C--Users-prais-Desktop-ai--claude\memory\MEMORY.md` under `## Tooling / infra`:
```
- [Shrine ledger](shrine-ledger.md) — offerings received at the desktop shrine (Shrine of Fable app)
```

- [ ] **Step 4: Full ceremony verification (the real thing)** — `npx tauri dev`, create `C:\Users\prais\Desktop\test_offering.txt` with a sentence in it, drag it onto the shrine. Confirm, in order: file vanished from Desktop; exists under `%USERPROFILE%\.shrine\reliquary\2026\<date>--test_offering.txt\`; `shrine-ledger.md` in the memory dir gained an entry; the shrine performed the keeper's chosen responses. Then kill network/rename `claude` temporarily and drop another file: confirm polite fallback + `pending.json` + processed on next launch.

- [ ] **Step 5: Build** — `npx tauri build` produces the installer/exe; run the built exe once and repeat one offering.

- [ ] **Step 6: Commit** — `feat: tauri bridge — the shrine is alive`

---

## Post-v1 (not in this plan)

Web deploy, accretion milestones, visitors (cat/spirits/fox), full Hours creatures, weather, rain-softens-rake-lines, launch-at-startup — see spec Phases v1.5. Phase 2 (graphify deep brain) is a separate project.

## Definition of done (v1)

- [ ] `npx vitest run` green; `cargo test` green.
- [ ] Keeper eval passes and the keeper's ledger tone is right (silence common, words rare and small).
- [ ] The full-ceremony verification in Task 18 Step 4 performed, including the keeper-away fallback.
- [ ] The shrine has sat on the desktop through a real dusk: candles were lit by the clauding while nobody was doing anything.
