"""Free the orange spirit's treasure: extract the white bundle he holds overhead
into its own sprite (bow.png) and erase it from his body sprite, so he can
carry it, present it, and — at last — set it down to rest."""
import pathlib

from PIL import Image

SPRITES = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"

im = Image.open(SPRITES / "mask_orange.png").convert("RGBA")
px = im.load()

# white-ish pixels in the top half = the held bundle
pts = [
    (x, y)
    for y in range(im.height // 2)
    for x in range(im.width)
    if px[x, y][3] > 0 and px[x, y][0] > 190 and px[x, y][1] > 190 and px[x, y][2] > 180
]
if not pts:
    raise SystemExit("no bundle found — already extracted?")

xs = [p[0] for p in pts]
ys = [p[1] for p in pts]
x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
print(f"bundle bbox: ({x0},{y0})-({x1},{y1})")

bundle = im.crop((x0 - 1, y0 - 1, x1 + 1, y1 + 1))
# keep only the white-ish pixels in the crop
bp = bundle.load()
for y in range(bundle.height):
    for x in range(bundle.width):
        p = bp[x, y]
        if not (p[3] > 0 and p[0] > 190 and p[1] > 190 and p[2] > 180):
            bp[x, y] = (0, 0, 0, 0)
bundle.save(SPRITES / "bow.png")

for x, y in pts:
    px[x, y] = (0, 0, 0, 0)

# also clear the orphaned grip pixels that held the bundle (floating above the head)
for y in range(46):
    for x in range(28, 72):
        if px[x, y][3] > 0:
            px[x, y] = (0, 0, 0, 0)

im.save(SPRITES / "mask_orange.png")
print("wrote bow.png, erased bundle + grip from mask_orange.png")
