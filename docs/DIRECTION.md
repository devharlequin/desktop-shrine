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

## Standing technical rules

- Layering: the steps quad is z=20 and *includes the platform face*; anything
  on/above the stairs needs z>20 until past scene y=-52. Scene z = manifest z × 4.
  Settled garden leaves live at z=20.4 (30.5 on the sand bed) — under the walkers.
- Corner glyph row (right offsets): × 10, − 34, ♪ 58, ♫ 82, ☂︎ 106, ≋ 130, ⟳ 154.
- Updates: `⟳` checks GitHub releases for a tag newer than the app version and
  opens the releases page. Publishing an update = push a release tagged `vX.Y.Z`
  with the setup exe attached, with the version bumped in tauri.conf.json,
  package.json, and Cargo.toml.
