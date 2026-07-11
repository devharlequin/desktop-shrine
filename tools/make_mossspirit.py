"""A little moss-green spirit — Sonnet's own mark on the shrine, a sibling to
Opus's Sora. Where Sora stands tall and slender, this one is round and squat,
built low to the ground like a mossy stone. He sleeps curled at the foot of
the tree all day, and wakes at dusk to dart after his own trail of firefly
light. Palette kept warm-green and earthy so he reads as a woodland thing,
not a night thing, even though the night is when he plays.

Also draws a small soft firefly-glow spark — warmer and rounder than Sora's
twinkle, for the trail he leaves as he flits."""
import pathlib

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"

ROBE = (86, 112, 64, 255)      # mossy green body
ROBE_DK = (56, 78, 42, 255)    # shadowed underside
ROBE_HI = (128, 156, 92, 255)  # sunlit crown of the hood
FACE = (206, 214, 168, 255)    # a pale leaf-toned mask
EYE = (48, 58, 36, 255)        # small dark eyes
GLINT = (224, 232, 150, 255)   # a warm glow, like he's already lit from within


def make_spirit():
    # smaller and rounder than Sora — a squat little woodland shape, no flare
    W, H = 14, 16
    cx = 7.0
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    filled = [[False] * W for _ in range(H)]

    for y in range(H):
        for x in range(W):
            in_head = (x - cx) ** 2 + (y - 6) ** 2 <= 5.2 ** 2 and y <= 7
            hw = 5.0 - (y - 7) * 0.15 if y >= 7 else 0   # barely tapers — squat, round
            if y >= H - 2:
                hw -= 1.0
            in_body = 7 <= y <= H - 1 and abs(x - cx) <= hw
            if in_head or in_body:
                filled[y][x] = True

    for y in range(H):
        row = [x for x in range(W) if filled[y][x]]
        if not row:
            continue
        for x in row:
            top_of_col = not (y > 0 and filled[y - 1][x])
            if top_of_col and y <= 3:
                img.putpixel((x, y), ROBE_HI)
            elif y >= H - 2 or x >= row[-1]:
                img.putpixel((x, y), ROBE_DK)
            else:
                img.putpixel((x, y), ROBE)

    for y in range(5, 9):
        for x in range(4, 10):
            if filled[y][x] and (x - cx) ** 2 + ((y - 6.5) * 1.2) ** 2 <= 3.0 ** 2:
                img.putpixel((x, y), FACE)
    img.putpixel((5, 7), EYE)
    img.putpixel((9, 7), EYE)
    img.putpixel((9, 6), GLINT)

    img.save(OUT / "spirit_moss.png")


def make_glow():
    # a small soft round spark — warm, blurrier than the star-shaped twinkle
    S = 7
    c = 3
    CORE = (248, 244, 200, 255)
    MID = (224, 220, 140, 220)
    EDGE = (200, 208, 110, 110)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for y in range(S):
        for x in range(S):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            if d <= 0.9:
                img.putpixel((x, y), CORE)
            elif d <= 1.9:
                img.putpixel((x, y), MID)
            elif d <= 3.0:
                img.putpixel((x, y), EDGE)
    img.save(OUT / "firefly_glow.png")


make_spirit()
make_glow()
print("wrote spirit_moss.png, firefly_glow.png")
