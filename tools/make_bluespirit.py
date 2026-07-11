"""A little pale-blue masked spirit — a third sibling to the purple keeper and
the orange treasure-bearer, drawn by Opus to leave a mark of my own on the
shrine. He loves the rain, and gazes up at the stars. Palette kept cool and
soft so he reads as kin to the other spirits but clearly his own.

Also draws a tiny four-point twinkle — the little sparks of wonder that rise
off him when he stargazes or is greeted."""
import pathlib

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"

ROBE = (126, 158, 196, 255)    # cool pale blue body
ROBE_DK = (92, 120, 158, 255)  # the shadowed underside / far edge
ROBE_HI = (170, 198, 228, 255) # light along the top of the hood
FACE = (224, 233, 242, 255)    # a pale mask
EYE = (60, 78, 110, 255)       # soft dark eyes
GLINT = (150, 210, 236, 255)   # a faint cyan catchlight — his little spark of life


def make_spirit():
    W, H = 16, 20
    cx = 8.0
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    filled = [[False] * W for _ in range(H)]

    # silhouette: a rounded hood over a gently flaring bell of a robe
    for y in range(H):
        for x in range(W):
            in_head = (x - cx) ** 2 + (y - 7) ** 2 <= 5.6 ** 2 and y <= 8
            hw = 4.0 + (y - 7) / (H - 2 - 7) * 2.9 if y >= 7 else 0
            if y >= H - 2:            # round the hem in a touch
                hw -= 1.2
            in_body = 7 <= y <= H - 1 and abs(x - cx) <= hw
            if in_head or in_body:
                filled[y][x] = True

    # shade: highlight the crown, shadow the lower/right, body in between
    for y in range(H):
        row = [x for x in range(W) if filled[y][x]]
        if not row:
            continue
        for x in row:
            top_of_col = not (y > 0 and filled[y - 1][x])
            if top_of_col and y <= 4:
                img.putpixel((x, y), ROBE_HI)          # lit crown of the hood
            elif y >= H - 3 or x >= row[-1]:
                img.putpixel((x, y), ROBE_DK)          # shadowed hem / far edge
            else:
                img.putpixel((x, y), ROBE)

    # a pale mask face with two soft eyes and a single cyan glint
    for y in range(6, 10):
        for x in range(5, 11):
            if filled[y][x] and (x - cx) ** 2 + ((y - 7.5) * 1.2) ** 2 <= 3.4 ** 2:
                img.putpixel((x, y), FACE)
    img.putpixel((6, 8), EYE)
    img.putpixel((10, 8), EYE)
    img.putpixel((10, 7), GLINT)   # a little light in one eye

    img.save(OUT / "spirit_blue.png")


def make_twinkle():
    # a small four-point star: bright core, tapering arms
    S = 7
    c = 3
    TW = (206, 228, 244, 255)
    CORE = (240, 248, 255, 255)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for d in range(0, 4):
        for (x, y) in [(c + d, c), (c - d, c), (c, c + d), (c, c - d)]:
            if 0 <= x < S and 0 <= y < S:
                img.putpixel((x, y), CORE if d == 0 else TW)
    img.putpixel((c + 1, c + 1), TW)
    img.putpixel((c - 1, c - 1), TW)
    img.save(OUT / "twinkle.png")


make_spirit()
make_twinkle()
print("wrote spirit_blue.png, twinkle.png")
