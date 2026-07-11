"""Draw a gnarled little tree (64x104 virtual px), palette matched to the night art.
Leaves will fall from its canopy; it stands left of the shrine, below the moon."""
import math
import pathlib
import random

from PIL import Image

random.seed(7)  # same tree every slice

W, H = 64, 104
TRUNK = (58, 52, 80, 255)
TRUNK_HI = (74, 67, 100, 255)
OUTLINE = (36, 30, 54, 255)
CANOPY = [(74, 84, 74, 255), (62, 74, 66, 255), (88, 98, 82, 255)]
CANOPY_DARK = (50, 58, 52, 255)
BLOSSOM = (184, 98, 46, 255)  # a few autumn-warm leaf clusters, matches leaf sprites

im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
px = im.load()


def blob(cx, cy, r, jitter=0.35):
    for y in range(int(cy - r), int(cy + r + 1)):
        for x in range(int(cx - r * 1.25), int(cx + r * 1.25 + 1)):
            if 0 <= x < W and 0 <= y < H:
                d = math.hypot((x - cx) / 1.25, y - cy)
                if d < r * (1 - jitter * random.random() * 0.4):
                    shade = CANOPY_DARK if y > cy + r * 0.35 else random.choice(CANOPY)
                    px[x, y] = shade


# trunk: leans slightly right, thick base
for y in range(H - 1, 34, -1):
    t = (H - 1 - y) / (H - 36)          # 0 at base -> 1 at top
    cx = 30 + int(t * 6)                # lean
    w = max(2, int(6 - t * 4))
    for x in range(cx - w // 2, cx + w // 2 + 1):
        px[x, y] = TRUNK_HI if x == cx - w // 2 + 1 else TRUNK
    px[cx - w // 2 - 1, y] = OUTLINE
    px[cx + w // 2 + 1, y] = OUTLINE
# a low branch to the left
for i in range(12):
    x, y = 28 - i, 62 - i // 2
    if 0 <= x < W:
        px[x, y] = TRUNK
        px[x, y + 1] = OUTLINE

# canopy: overlapping blobs, wider than tall
blob(34, 26, 14)
blob(20, 32, 11)
blob(48, 32, 10)
blob(12, 52, 7)   # branch tuft
blob(36, 14, 9)
# sparse warm clusters (the leaves that will fall)
for _ in range(9):
    x = random.randint(10, 54)
    y = random.randint(12, 40)
    if px[x, y][3] > 0:
        px[x, y] = BLOSSOM
        if x + 1 < W and px[x + 1, y][3] > 0:
            px[x + 1, y] = BLOSSOM

out = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites" / "tree.png"
im.save(out)
print("wrote", out)
