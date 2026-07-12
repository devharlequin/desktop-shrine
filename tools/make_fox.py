"""Momiji (紅葉, "autumn leaves") — Fable's own mark on the shrine.

Sora and Hotaru are residents; Momiji is a VISITOR. A little wild fox — the
messenger animal of real shrines, and the storyteller's animal in every fable
tradition, which makes her mine. She trots in rarely, sits a while facing the
shrine, sometimes dips her head, and leaves. She cannot be petted: startle
her and she bolts. The residents are family; the fox is a guest.

Two poses: a side-view trot (facing left — code flips her) and a sitting
pose, tail curled around her feet. Fox-red like autumn leaves, cream chest
and tail tip, dark stockings and ear tips.
"""
import pathlib

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"

P = {
    "o": (194, 88, 42, 255),    # autumn-red coat
    "O": (226, 122, 58, 255),   # sunlit back
    "d": (74, 44, 26, 255),     # dark stockings, ear tips, nose
    "c": (236, 216, 180, 255),  # cream chest, muzzle, tail tip
    "e": (34, 22, 12, 255),     # eye
}


def paint(rows, name):
    h = len(rows)
    w = max(len(r) for r in rows)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in P:
                img.putpixel((x, y), P[ch])
    img.save(OUT / name)


# trotting, facing left: nose low and forward, ears pricked, brush of a tail
# carried level behind, one cream-tipped end. 20 x 13.
TROT = [
    "..d..d..............",
    "..oo.oo.............",
    "..ooooo.......dd....",
    "..oOeoo......dccd...",
    "dcooooOOOOOOooccc...",
    ".ccoooooooooooocc...",
    "..coooooooooooo.....",
    "...ooo.ooooo.oo.....",
    "...oo...oo....oo....",
    "...do...do....do....",
    "....................",
]

# sitting, facing left: upright, ears tall, tail curled around her feet so
# the cream tip rests in front. 14 x 16.
SIT = [
    ".d..d.........",
    ".oo.oo........",
    ".ooooo........",
    ".oOeoo........",
    "coooooo.......",
    ".cooooo.......",
    "..ccoo........",
    "..ccooo.......",
    "..cooooo......",
    "...ooooooo....",
    "...oooooooooo.",
    "...ooooooooOo.",
    "...oooooooOOo.",
    "...oo.oo.ooOo.",
    "...do.do.cccc.",
    "..........cc..",
]

paint(TROT, "fox_trot.png")
paint(SIT, "fox_sit.png")
print("wrote fox_trot.png, fox_sit.png")
