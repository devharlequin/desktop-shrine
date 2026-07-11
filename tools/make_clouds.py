"""Little rain clouds that roll in with the weather. Soft grey-lavender pixel
puffs with a flat underside, a lighter top edge and a darker rim — moody, to
match the shrine's dusk/night sky. Palette matched to the shrine art."""
import pathlib

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"

MID = (124, 120, 146, 255)   # the body of the cloud
TOP = (152, 148, 174, 255)   # light catches the upper edge
LOW = (98, 94, 120, 255)     # the heavy underside, swollen with rain
EDGE = (78, 74, 100, 255)    # the darkest rim along the very bottom


def make_cloud(name, w, h, lobes):
    """lobes: list of (cx, cy, r) circles. Filled, flattened to a level base,
    then shaded top-light / bottom-dark."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    base = h - 1  # the flat underside sits one pixel up from the frame edge

    # 1) fill every pixel inside any lobe circle
    filled = [[False] * w for _ in range(h)]
    for (cx, cy, r) in lobes:
        for y in range(h):
            for x in range(w):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    filled[y][x] = True

    # 2) flatten the bottom: under any filled column, fill down to the base
    for x in range(w):
        top = next((y for y in range(h) if filled[y][x]), None)
        if top is None:
            continue
        for y in range(top, base + 1):
            filled[y][x] = True

    # 3) shade: interior MID, top pixel of each column TOP, base rows darker
    for x in range(w):
        col = [y for y in range(h) if filled[y][x]]
        if not col:
            continue
        top, bottom = col[0], col[-1]
        for y in col:
            if y == top:
                img.putpixel((x, y), TOP)
            elif y >= base:
                img.putpixel((x, y), EDGE)
            elif y >= bottom - 1:
                img.putpixel((x, y), LOW)
            else:
                img.putpixel((x, y), MID)

    img.save(OUT / f"{name}.png")
    return name


made = [
    make_cloud("cloud1", 34, 15, [(9, 9, 7), (18, 7, 8), (26, 9, 6)]),
    make_cloud("cloud2", 50, 18, [(12, 12, 8), (24, 8, 11), (36, 11, 9), (44, 13, 6)]),
    make_cloud("cloud3", 40, 16, [(10, 11, 7), (20, 8, 9), (30, 10, 8)]),
]
print("wrote", ", ".join(f"{n}.png" for n in made))
