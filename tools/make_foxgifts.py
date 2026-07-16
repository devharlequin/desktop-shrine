"""The fox's dish, and what she leaves in return.

Real inari shrines set out aburaage — golden fried tofu — for their foxes.
Ours gets a little ceramic dish at the garden rim. And because the one who
feeds a wild thing is eventually paid in kind (ask anyone who has kept
crows), Momiji brings gifts once she trusts you: a shiny button, an old
zeni coin, a bottle cap — and, rarest, a small beat-up shiny card, in
honor of a crow who once paid for her peanuts with a Pokemon card.
"""
import pathlib

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"


def paint(rows, palette, name):
    h = len(rows)
    w = max(len(r) for r in rows)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in palette:
                img.putpixel((x, y), palette[ch])
    img.save(OUT / name)


# a shallow ceramic dish, glazed the grey-blue of the shrine roof. 9 x 4.
paint([
    ".bbbbbbb.",
    "bwwwwwwwb",
    ".bbbbbbb.",
    "..ddddd..",
], {
    "b": (96, 110, 128, 255),   # glaze
    "w": (168, 180, 194, 255),  # inner glaze, catching light
    "d": (58, 64, 76, 255),     # foot, in shadow
}, "fox_dish.png")

# aburaage — a golden slab of fried tofu, the proper offering. 6 x 3.
paint([
    ".gggg.",
    "gGGGGg",
    ".gggg.",
], {
    "g": (196, 142, 58, 255),   # fried gold
    "G": (226, 178, 92, 255),   # the softer middle
}, "fox_food.png")

# a shiny blue button, two thread-holes. 5 x 5.
paint([
    ".bbb.",
    "bBhBb",
    "bBBBb",
    "bBhBb",
    ".bbb.",
], {
    "b": (44, 84, 148, 255),
    "B": (92, 142, 214, 255),
    "h": (24, 44, 80, 255),
}, "gift_button.png")

# an old zeni coin, square hole, bronze gone green at the rim. 5 x 5.
paint([
    ".ccc.",
    "cCCCc",
    "cC.Cc",
    "cCCCc",
    ".ccc.",
], {
    "c": (108, 122, 84, 255),   # verdigris rim
    "C": (168, 138, 72, 255),   # worn bronze
}, "gift_coin.png")

# a red bottle cap, fluted edge, found who-knows-where. 5 x 4.
paint([
    ".rrr.",
    "rRRRr",
    "rRwRr",
    ".rrr.",
], {
    "r": (142, 40, 34, 255),
    "R": (198, 66, 52, 255),
    "w": (232, 226, 214, 255),  # a glint
}, "gift_cap.png")

# the rare one: a small card, corners soft with age, holo foil still
# catching light in three colors. For the crow. 5 x 7.
paint([
    "wwwww",
    "wpgbw",
    "wgbpw",
    "wbpgw",
    "wpgbw",
    "wwwww",
    ".w.w.",  # a bottom edge gone ragged
], {
    "w": (214, 206, 188, 255),  # aged cardstock
    "p": (198, 120, 188, 255),  # holo pink
    "g": (110, 196, 158, 255),  # holo green
    "b": (110, 150, 214, 255),  # holo blue
}, "gift_card.png")

print("wrote fox_dish, fox_food, gift_button, gift_coin, gift_cap, gift_card")
