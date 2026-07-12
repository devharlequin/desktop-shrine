# Direction notes

A living note for whoever works on the shrine next (human or Claude).

## The 2026-07-11 unlock: the shrine may move

The original ethos held the scene *serene and unmoving* — stillness first,
behavior only where it carried meaning. Runa has explicitly lifted the
stillness half of that rule:

> If you want to put movements and animations and behaviors onto the
> "little guys" in the scene, you can follow your heart. It's okay if
> there's movement on the screen. It can be like a little tranquil window
> where you watch some cute little goobers in a little scene enjoying
> themselves.

So: idle animations, small behaviors, critters interacting with the weather
and each other — welcome, no permission needed. What still stands:

- **The shrine never speaks.** No text, labels, popups, or announcements.
  Behavior is the only language.
- **Silence is honorable; the bell is reserved.**
- **Features feel discovered, not announced.**
- **Tranquil, not busy.** Movement should read as a garden being alive,
  not a screensaver demanding attention.

## The garden close-up (2026-07-12)

Clicking the sand bed glides the orthographic camera into a 4× close-up
(`GARDEN_VIEW` in main.ts, framed on `SAND_RECT`); clicking anywhere else, or
Esc, steps back. While zoomed:

- The sand quad swaps to a 4×-resolution canvas (`SandPatch.setZoomed`) so
  grooves drawn up close keep sub-pixel detail; the far view keeps the
  original 1× texture, exactly as before.
- A tool rack (`sandTools.ts`, z=32, row at virtual y=207) fades in on the
  ground above the bed: rake, wide rake, pointed stick, ring stamp, smoothing
  board (a local eraser — `eraseStrokesNear` splits strokes where it presses).
  Strokes remember their tool (`RakeStroke.tool`; old saves read as 'rake').
- Sora steps politely off the sand (his home stands on it) and watches from
  its edge; he returns when you step back.
- Pointer→virtual mapping goes through `viewNow` — anything that reads the
  mouse must use it, or clicks land in the wrong place while zoomed.
- Window drag-by-sky is gated off while zoomed.

Save safety (learned the hard way — a mid-write read once wiped the garden):
`write_text` is atomic (temp + rename) and keeps `<name>.bak`; `loadGarden`
falls back to the .bak rather than accepting an empty garden where one stood.

## Standing technical rules

- Layering: the steps quad is z=20 and *includes the platform face*; anything
  on/above the stairs needs z>20 until past scene y=-52. Scene z = manifest z × 4.
  Settled garden leaves live at z=20.4 (30.5 on the sand bed) — under the walkers.
- Corner glyph row (right offsets): × 10, − 34, ♪ 58, ♫ 82, ☂︎ 106, ≋ 130, ⟳ 154.
- Updates: `⟳` uses the Tauri updater — it checks `releases/latest/download/latest.json`,
  and clicking it downloads the new setup exe, verifies its minisign signature,
  runs the installer (passive), and relaunches. Browser fallback (releases page)
  only if that fails.

### Publishing a release (the updater depends on every step)
1. Bump the version in **tauri.conf.json, package.json, and src-tauri/Cargo.toml**.
2. Build **signed**: set `TAURI_SIGNING_PRIVATE_KEY` to the private key's
   *content* (e.g. `export TAURI_SIGNING_PRIVATE_KEY="$(cat <keyfile>)"` — the
   `_PATH` variant is NOT read; key kept OUTSIDE the repo, pubkey pinned in
   tauri.conf.json must match) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""`,
   then `npx tauri build`. This produces the `-setup.exe` and a `.sig` beside it.
3. `node tools/make_latest_json.mjs` → writes `latest.json` into the bundle dir.
4. `gh release create vX.Y.Z <setup.exe> <setup.exe.sig> <latest.json> --title ... --notes ...`
   — **all three assets**, on a tag matching the version. Older shrines' ⟳
   glyphs glow within a launch, and one click carries the update in.
   (An unsigned build or a missing latest.json breaks auto-update for that release.)
