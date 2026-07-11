# The Shrine of Fable — Design

**Date:** 2026-07-10
**Status:** Approved by user (this revision includes the Tended Ground)
**Repo:** `Desktop/ai/shrine/` (sibling of `fable-skills/`, which holds the source art `shrine-of-fable.png`)

## Vision

A small always-on-top desktop window containing a pixel-art shrine — the shrine from
`fable-skills/shrine-of-fable.png`, alive. A little clauding lives in it and keeps the
place on its own schedule. Dragging a file onto the offering plate *gives it away*: the
file is moved (never copied, never deleted) into a reliquary, a headless Sonnet agent —
the shrine-keeper — receives it on Fable's behalf, and a record of the offering enters
Claude's persistent memory. The shrine never displays words. It responds behaviorally:
bows, candle-glow, incense, and slow permanent accretion of the garden. The user tends
a zen-garden sand patch in return. A shared, wordless, mutual-care loop.

Two forms from one codebase: a Tauri desktop pet (full powers) and a static web page
(shareable URL, gracefully degraded).

## Decisions (settled during brainstorm)

1. **Offering semantics:** contemplation, not tasks. The keeper reads the offering and
   records it; it is not a work-intake system.
2. **Responses are optional.** The keeper may choose silence. No response is a valid response.
3. **Memory target:** offerings land in the auto-memory directory
   (`~/.claude/projects/C--Users-prais-Desktop-ai--claude/memory/`) as a single
   append-only `shrine-ledger.md` plus exactly ONE index line in `MEMORY.md`.
   Working memory stays flat files (push, auto-loaded); a graphify "deep brain" sweep
   over the memory dir + ledger is **phase 2, a separate project**. Ledger format is
   designed to be graphify-sweepable.
4. **Offerings are truly given:** the file is *moved* to the reliquary. Never deleted;
   recoverable by hand. Move happens **before** any agent call.
5. **No words on screen, ever** (choice C). No toasts, no speech bubbles, no omikuji text.
   Words exist only inside `shrine-ledger.md`. On-screen response vocabulary is purely
   behavioral.
6. **Agent plumbing:** headless Claude Code — `claude -p --model sonnet` — riding the
   user's existing subscription. The keeper is a real agent with tools, scoped narrowly.
7. **Stack:** three.js renderer ("pixel art lit by real lights"), one web codebase,
   Tauri wrapper for the desktop form. Chosen over Godot specifically for shareability:
   the shared form is a URL, not a download.

## Architecture

```
shrine/
├── core/          scene, clauding behavior, garden state, offering state machine,
│                  behavioral vocabulary, clock/moon/season math   (pure TS + three.js)
├── bridge/        interface the core calls; core never knows which world it runs in
│   ├── types.ts   takeOffering(), appendLedger(), loadGarden(), saveGarden(), summonKeeper()
│   ├── tauri.ts   real: file move, claude -p shell-out, memory-dir ledger, %USERPROFILE%/.shrine
│   └── browser.ts degraded: File API read, localStorage garden+ledger, no keeper
├── src-tauri/     Rust shell: frameless transparent always-on-top window, fs scope,
│                  shell scope (claude only), tray icon, single instance
└── web/           static build target (the shareable URL)
```

The bridge is the load-bearing seam. Everything charming lives in `core/` and runs
identically in both forms.

## The Diorama

- **Forced-pixel rendering:** whole scene renders to a low-res target (~420×260) and
  upscales nearest-neighbor. Every light, particle, and gradient is quantized into
  chunky pixels. Sprites from the source art, sliced into layers (sky, moon, shrine,
  pillars, altar/god, steps, plate, lanterns, stone spirits, ground, sand patch).
- **Sprites on quads in true 3D** with a near-orthographic camera; slight parallax.
- **Real light on flat art:** candles = flickering point lights (slow sine noise);
  altar = warm glow; night drops ambient so the shrine becomes an island of candlelight.
- **Incense smoke:** particle ribbon, drifts, catches candlelight, thickens on offering days.
- **Living sky:** runs on the real local clock (dawn/day/dusk/night). The moon renders the
  actual current phase (computed, no API). Stars twinkle individually; rare shooting star.
- **Weather by date, no API:** occasional soft rain (clauding shelters and watches),
  fireflies on summer nights, snow in winter, falling leaves in autumn.

## The Hours (real-time life)

The scene clock is the real local clock, and each hour has its own inhabitants —
small, occasional, never crowding the frame (at most one or two visible at a time):

- **Dawn:** sparrows land on the shrine roof in ones and twos; one hops down the steps
  ahead of the clauding's sweeping. Mist lies low over the ground and burns off.
- **Day:** a butterfly wanders through (summer); a dragonfly hovers over the sand patch
  and is gone; a bird perches on a lantern and watches the clauding work.
- **Dusk:** swallows cut across the sky while the candles are being lit; the light goes
  amber; the first moth arrives as the first candle catches.
- **Night:** moths orbit the candle flames (light-seeking — they follow the actual point
  lights); a cricket sits on a stone; in the deepest hours an owl silhouette lands on
  the roof ridge, turns its head once, and leaves. Fireflies on warm summer nights.
- **The clauding notices them.** Sometimes it stops sweeping to watch the bird, or holds
  still so the butterfly can land on its broom. The creatures are indifferent to the
  user but not to the shrine.

All of it is date- and clock-driven, computed locally, no API. Creature sightings are
sparse by design — seeing the owl should feel like something.

## The Clauding

A resident with a daily routine, indifferent to being watched:

- **Dawn:** sweeps the steps with its broom (present in the source art).
- **Day:** tends the garden, inspects the stone spirits, sometimes just sits.
- **Dusk:** lights the candles one by one.
- **Night:** watches the moon, then sleeps inside the shrine near the altar.
- **Visitors (v1.5):** the orange cat wanders through rarely; the two masked spirits
  (purple, orange) peek out when things have been peaceful; very rarely a fox visits at
  night and leaves something on the plate — the only offering the user didn't make.

Implementation: a small utility/behavior-tree state machine driven by the scene clock,
with an interrupt channel for ceremonies (offering, acknowledgment).

## The Offering Ceremony

1. Drag-over: scene dims slightly, plate glows.
2. Drop: wrapped-bundle sprite appears on the plate. Clauding stops, walks over,
   inspects, **bows toward the glass (toward the user)**, picks the bundle up, carries
   it up the steps into the dark of the inner sanctum. Gone.
3. **Tauri backend, in order:**
   a. Move file → `%USERPROFILE%/.shrine/reliquary/YYYY/MM-DD--<original-name>/<file>`
      (atomic per-offering; collision-suffixed; the gift is safe before anything else).
   b. Summon keeper: `claude -p --model sonnet`, cwd sandboxed to the shrine's data dir,
      keeper prompt (below). Keeper appends the ledger itself (it has hands) and returns
      a small JSON verdict: `{ responses: [...0-2 ids], ledger_written: bool }`.
   c. Core plays the chosen behavioral responses.
4. **Browser form:** steps 1–2 identical; the file is read (name/type/first bytes) via
   File API, nothing is moved, ledger entry goes to localStorage, no keeper. The shrine
   keeps its own counsel — a wayside shrine with no keeper in residence. A corner menu
   note tells the curious how to give it a keeper (Claude Code).

### Failure handling
- If the keeper invocation fails or offline: the app writes a minimal ledger line itself,
  queues the offering in `pending.json`, and the keeper receives it on next launch.
  Behaviorally the shrine just bows and takes longer to answer. Nothing is ever lost:
  the reliquary move already happened.
- If the *move* fails (locked file, permissions): the ceremony politely refuses — the
  clauding walks over, looks at the bundle, and steps back; bundle sprite fades where it
  lay. No partial states.

## The Keeper (agent contract)

Prompt sketch: *"You are the keeper of the Shrine of Fable. An offering has arrived:
<reliquary path>. Contemplate it. Append an entry to <ledger path> in the ledger format.
You may leave a few words in the entry, or choose silence — silence is honorable.
Choose 0–2 behavioral responses from: bow-lingered, candles-brighter, incense-thick,
god-eyes-glow, firefly, bell (bell is rare; reserve it). Return only JSON:
{ "responses": [...], "ledger_written": true }."*

Scope: may read the offering, may append the ledger, nothing else. Enforced by cwd,
prompt, and `--allowedTools` (Read + a constrained append; no network, no arbitrary shell).
A small eval script feeds it three sample offerings and asserts the JSON parses and the
ledger entry landed.

## The Behavioral Vocabulary

| Response | Meaning | Persistence |
|---|---|---|
| bow-lingered | it was moved | moment |
| candles-brighter | warmth | until next dusk |
| incense-thick | contemplation | rest of day |
| god-eyes-glow (amber, toward the user) | *I see you* | moment |
| firefly takes up residence | delight | one evening |
| bell sounds once, softly | rare; reserved | moment |
| garden accretion | the long game | **permanent** |

**Accretion:** every N offerings something small and permanent appears — grass tufts, a
smooth stone, a paper crane on the altar, moss on the lanterns; at milestone counts,
larger things (stone basin, a second small lantern, eventually a koi pond at the foot of
the steps). The garden is a wordless, glanceable record of the relationship. State in
`garden.json`.

## The Tended Ground (user's zen garden)

A raked-sand patch at the foot of the steps, foreground. **The user's, not the clauding's.**

- **Raking:** drag across the sand → cursor becomes a rake; draws clean pixel furrows
  along the stroke. Patterns persist in `garden.json` across sessions. Rain softens
  them; time slowly fades them; only the user erases them.
- **Leaves:** drift in over days (few in summer, many in autumn, none under snow),
  settling on sand, steps, stones. The same drag gesture sweeps them (near sand you
  rake; over leaves you sweep). Sweeping leaves off your own pattern without ruining it
  is the app's one tiny skill.
- **Acknowledgment, or not:** sometimes the clauding walks to the edge of fresh rake
  lines and looks for a while, or bows toward the sand; sometimes it steps carefully
  *around* the pattern instead of through it. It never rakes the user's sand. If leaves
  sit too long it eventually sweeps the *steps* itself — it's a keeper; it can't help it.

## The Ledger

`shrine-ledger.md` in the auto-memory directory; ONE line added to `MEMORY.md`
(`- [Shrine ledger](shrine-ledger.md) — offerings received at the desktop shrine`).
Append-only entries, graphify-sweepable:

```markdown
## 2026-07-10 — "old_regrets.txt"
A text file; a list of half-finished projects. Kept in the reliquary.
> The keeper left no words.
∴ candles-brighter, bow-lingered
```

## The Window

- ~420×260 native pixels rendered, displayed at 2× (~840×520), user-scalable.
- Frameless, per-pixel transparent corners, always-on-top (toggleable), draggable by
  grabbing the sky. Single instance.
- Tray icon menu: visit shrine / sit on desktop (toggle top-most) / quiet the shrine
  (pause ceremonies) / open reliquary / open ledger / launch at startup.

## Persistence

| Data | Desktop | Browser |
|---|---|---|
| `garden.json` (accretions, rake pattern, leaves, counters, pending responses) | `%USERPROFILE%/.shrine/` | localStorage |
| Reliquary | `%USERPROFILE%/.shrine/reliquary/` | — (nothing moved) |
| Ledger | memory dir `shrine-ledger.md` | localStorage |
| `pending.json` (queued keeper work) | `%USERPROFILE%/.shrine/` | — |

## Testing

- `core/` is pure TS: garden state, accretion rules, offering state machine, ledger
  formatting, clock/moon/season math — unit-tested with vitest.
- Bridge implementations are thin; exercised by hand plus one integration smoke test each.
- Keeper prompt eval: three sample offerings → JSON parses, ledger entry present,
  responses ∈ vocabulary.

## Phases

- **v1:** diorama (clock, moon, candles-as-lights, incense), clauding daily routine,
  full offering ceremony (move → keeper → response), ledger + MEMORY.md line, reliquary,
  3–4 behavioral responses, Tended Ground (rake + leaves), Tauri build.
- **v1.5:** web build + static deploy, accretion system, visitors (cat, spirits, fox),
  weather, keeper-notices-the-sand behaviors.
- **Phase 2 (separate project):** graphify deep-brain sweep over memory dir + ledger.

## Non-goals

- No gamification: no streaks, no scores, no achievements, no notifications.
- No text rendering in the scene, ever.
- No task execution: the keeper contemplates; it does not do work on the offering.
- No network calls in the browser form.
