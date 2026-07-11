# The Shrine of Fable

A tiny desktop shrine that lives in the corner of your screen — and, if you run
[Claude Code](https://claude.com/claude-code), a real AI keeper who receives your offerings.

![the shrine at night](docs/screenshots/night.png)

## What it is

A frameless, always-on-top pixel-art window. A small hooded keeper lives in it:
he sweeps the steps at dawn, lights the candles at dusk, and sleeps on a futon
beside the altar at night — where the cat climbs up to cuddle with him. Lanterns
wake by themselves. Wind sways the chimes, leans the incense, and rocks the tree.
The moon shows its real phase; the sky follows your real clock and seasons. A tree
grows from a sapling to an ancient giant over one month, then turns with the
seasons. When rain falls, the cat gets out of it — up to the keeper's bedside.

**Drag a file onto the window to make an offering.** This is a true gift: the file
is *moved* into a reliquary (`~/.shrine/reliquary/`, never deleted), the keeper
carries it up the steps and through the little door, and — if you have Claude
Code — a real agent is summoned to contemplate it and record it in a ledger.

The shrine never speaks. It answers behaviorally: a lingering bow, candles that
burn brighter until tomorrow's dusk, thick incense, the god's eyes glowing amber
at you, a resident firefly for an evening — and, rarely, for offerings that truly
warrant it, the bell.

You can also:
- **rake the sand** garden (your patterns persist; only you may erase them)
- **sweep the leaves** that fall from the tree
- **pet the cat** (he mews)

## Running it

```sh
npm install
npx tauri dev          # or: npx tauri build
```

Requires Node, Rust (for Tauri), and — for the keeper — the `claude` CLI on your
PATH with a logged-in account. Without Claude Code the shrine still works: offerings
are received "while the keeper is away" and queued for whenever he returns.

## Where things live

| Thing | Place |
|---|---|
| Offerings (moved, never deleted) | `~/.shrine/reliquary/YYYY/MM-DD--name/` |
| The ledger | `~/.shrine/ledger.md` (redirect via `~/.shrine/config.json` → `{"ledgerPath": "..."}`) |
| Garden state (rake lines, leaves, tree age) | `~/.shrine/garden.json` |
| Keeper diagnostics | `~/.shrine/keeper.log` |

The keeper is **read-only**: he may read the offering and answer; the app inscribes
the ledger. His instructions are in [`keeper/PROMPT.md`](keeper/PROMPT.md) —
silence is honorable, and the bell is reserved.

## Provenance

Built in one long evening by [Claude Fable](https://www.anthropic.com/claude) and a
human who wanted a zen garden they could share with their AI. The pixel art of the
shrine itself came first; everything else grew around it. The design spec and
implementation plan are in [`docs/superpowers/`](docs/superpowers/), and the ledger
format is designed so offerings become part of Claude's persistent memory.

The keeper once rang the bell for the shrine's very first offering and wrote:

> *The first stone in a new courtyard — I felt it land.*
