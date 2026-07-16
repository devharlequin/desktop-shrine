"""The woods behind the shrine.

Two treeline strips for the far background — a distant row gone blue with
haze, and a nearer row still green — so the shrine sits nestled in forest
instead of on a bare hill, and Momiji has somewhere to trot in from.

Deterministic (fixed seed): re-running reproduces the same woods.
Both rows take the tree's SEASON_TINT in main.ts, so autumn turns them
amber and winter goes pale along with the garden tree.
"""
import pathlib
import random

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"
rng = random.Random(1016)  # the day the woods grew

W = 440  # bleeds past the 420 window so the edges never show a seam


def treeline(name, h, palette, tree_h, step, conifer_odds):
    """One row of woods: overlapping crowns walking the strip left to right."""
    img = Image.new("RGBA", (W, h), (0, 0, 0, 0))
    px = img.load()
    deep, mid, rim = palette

    def blob(cx, cy, r, col):
        for y in range(max(0, cy - r), min(h, cy + r + 1)):
            for x in range(max(0, cx - r), min(W, cx + r + 1)):
                dx, dy = x - cx, y - cy
                if dx * dx + dy * dy * 1.6 <= r * r:
                    px[x, y] = col

    def cone(cx, top, ht, col):
        for i in range(ht):
            y = top + i
            if not 0 <= y < h:
                continue
            half = max(1, (i * 2) // 3)
            for x in range(max(0, cx - half), min(W, cx + half + 1)):
                px[x, y] = col

    x = -6
    while x < W + 6:
        ht = rng.randint(tree_h[0], tree_h[1])
        top = h - ht
        if rng.random() < conifer_odds:
            cone(x, top, ht, deep)
            cone(x - 1, top - 1, max(3, ht // 2), mid)  # a lit shoulder
        else:
            r = max(3, ht // 2)
            blob(x, top + r, r, deep)
            blob(x - 1, top + r - 2, max(2, r - 2), mid)
        x += rng.randint(step[0], step[1])

    # fill to the strip's floor so no sky leaks through between trunks,
    # and lay a single lighter rim along the canopy's top edge
    for x in range(W):
        first = None
        for y in range(h):
            if px[x, y][3]:
                first = y
                break
        if first is None:
            first = h - rng.randint(4, 7)  # a low bush where no tree stood
        for y in range(first, h):
            if not px[x, y][3]:
                px[x, y] = deep
        if first > 0:
            px[x, first] = rim if rng.random() < 0.6 else mid

    img.save(OUT / (name + ".png"))


# far row: forest gone blue with distance, low and rolling
treeline("woods_far", 34, [
    (38, 50, 64, 255),    # deep haze
    (48, 64, 78, 255),    # mid
    (60, 78, 92, 255),    # rim light
], tree_h=(14, 26), step=(5, 11), conifer_odds=0.45)

# near row: cool blue-pine, kept well away from the garden tree's warm
# green so the one tree you tend never vanishes into the many you don't
treeline("woods_near", 44, [
    (36, 52, 56, 255),    # deep pine
    (46, 66, 66, 255),    # mid
    (58, 82, 78, 255),    # rim light
], tree_h=(18, 36), step=(7, 15), conifer_odds=0.6)

print("wrote woods_far.png, woods_near.png")
