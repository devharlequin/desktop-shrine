"""Cursor + tiny-heart sprites: rake (for sand/leaves), paw (for the cat)."""
import pathlib

from PIL import Image

OUT_CURSORS = pathlib.Path(__file__).resolve().parents[1] / "public" / "cursors"
OUT_SPRITES = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"
OUT_CURSORS.mkdir(parents=True, exist_ok=True)

HANDLE = (154, 106, 62, 255)
METAL = (200, 194, 214, 255)
LINE = (36, 30, 54, 255)
PAW = (240, 234, 224, 255)
PINK = (224, 140, 176, 255)


def scale(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


# rake: 12x12 diagonal handle + 4-tine head, drawn at 12 then scaled 2x -> 24px cursor
rake = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
for i in range(7):
    rake.putpixel((10 - i, 1 + i), HANDLE)
    rake.putpixel((10 - i, 2 + i), LINE)
for i, (dx, dy) in enumerate([(0, 0), (1, 1), (2, 2), (3, 3)]):
    x, y = 1 + dx, 7 + dy - dx  # fan the tines
for t in range(4):
    x = 1 + t
    rake.putpixel((x, 8), METAL)
    rake.putpixel((x, 9), METAL)
    rake.putpixel((x, 10), LINE)
scale(rake, 2).save(OUT_CURSORS / "rake.png")

# paw: 12x12 pad + 3 toes, scaled 2x
paw = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
for x in range(4, 9):
    for y in range(6, 10):
        paw.putpixel((x, y), PAW)
paw.putpixel((4, 6), (0, 0, 0, 0))
paw.putpixel((8, 6), (0, 0, 0, 0))
for tx in (3, 6, 9):
    paw.putpixel((tx, 3), PAW)
    paw.putpixel((tx, 4), PAW)
scale(paw, 2).save(OUT_CURSORS / "paw.png")

# heart: 5x5, for petting the cat
heart = Image.new("RGBA", (5, 5), (0, 0, 0, 0))
for x, y in [(1, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 2), (2, 2), (3, 2), (2, 3)]:
    heart.putpixel((x, y), PINK)
heart.save(OUT_SPRITES / "heart.png")

print("wrote rake.png, paw.png, heart.png")
