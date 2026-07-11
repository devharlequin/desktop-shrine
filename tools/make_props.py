"""Props for the finishing touches: the keeper's doorway, his little bed,
and the wind chimes under the eaves. Palette matched to the shrine art."""
import pathlib

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"

STONE = (138, 129, 153, 255)
STONE_DARK = (98, 90, 118, 255)
DARK = (22, 18, 31, 255)
WARM = (58, 42, 36, 255)
WOOD = (106, 74, 46, 255)
STRING = (184, 176, 200, 255)
ROD = (216, 207, 168, 255)
ROD_HI = (240, 232, 196, 255)
PAPER = (232, 226, 208, 255)
FUTON = (138, 74, 78, 255)
FUTON_DARK = (106, 56, 60, 255)
BLANKET = (168, 106, 106, 255)
PILLOW = (216, 211, 200, 255)

# --- doorway: a small stone arch with a deep dark opening -------------------
door = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
for y in range(24):
    for x in range(16):
        inside = 2 <= x <= 13 and (y >= 4 or (2 + abs(x - 7.5) <= 6 and y >= 2))
        if inside:
            door.putpixel((x, y), DARK)
# arch frame
for y in range(2, 24):
    door.putpixel((1, y), STONE)
    door.putpixel((14, y), STONE)
for x in range(1, 15):
    door.putpixel((x, 1 if 4 <= x <= 11 else 2), STONE)
for x in range(4, 12):
    door.putpixel((x, 0), STONE_DARK)
# faint warm depth at the floor of the opening
for x in range(3, 13):
    door.putpixel((x, 22), WARM)
    door.putpixel((x, 23), WARM)
door.save(OUT / "doorway.png")

# --- the keeper's bed: a little futon with a pillow --------------------------
bed = Image.new("RGBA", (26, 10), (0, 0, 0, 0))
for y in range(3, 9):
    for x in range(1, 25):
        bed.putpixel((x, y), FUTON)
for x in range(1, 25):
    bed.putpixel((x, 9), FUTON_DARK)
for y in range(3, 7):  # folded blanket
    for x in range(3, 16):
        bed.putpixel((x, y), BLANKET)
for y in range(2, 6):  # pillow
    for x in range(18, 24):
        bed.putpixel((x, y), PILLOW)
bed.save(OUT / "bed.png")

# --- wind chime: wooden bar, three rods, a paper tail ------------------------
chime = Image.new("RGBA", (9, 17), (0, 0, 0, 0))
for x in range(1, 8):
    chime.putpixel((x, 1), WOOD)
    chime.putpixel((x, 2), WOOD)
chime.putpixel((4, 0), STRING)  # hanger
for i, (x, length) in enumerate([(2, 6), (4, 8), (6, 5)]):
    chime.putpixel((x, 3), STRING)
    for y in range(4, 4 + length):
        chime.putpixel((x, y), ROD_HI if y == 4 else ROD)
# paper tail on the middle string
for y in range(12, 16):
    chime.putpixel((4, y), PAPER)
    if y < 15:
        chime.putpixel((5, y), PAPER)
chime.save(OUT / "chime.png")

print("wrote doorway.png, bed.png, chime.png")
