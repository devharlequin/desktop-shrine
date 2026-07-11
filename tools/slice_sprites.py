"""Slice shrine-of-fable.png into layer PNGs per tools/layers.json.
Usage:
  python tools/slice_sprites.py --grid   # writes tools/_grid.png with 50px grid for measuring
  python tools/slice_sprites.py          # slices all layers to public/sprites/
"""
import json
import pathlib
import sys

from PIL import Image, ImageDraw

SRC = pathlib.Path(r"C:\Users\prais\Desktop\ai\fable-skills\shrine-of-fable.png")
OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites"
LAYERS = pathlib.Path(__file__).parent / "layers.json"


def grid():
    im = Image.open(SRC).convert("RGBA")
    d = ImageDraw.Draw(im)
    for x in range(0, im.width, 50):
        d.line([(x, 0), (x, im.height)], fill=(255, 0, 0, 120))
        d.text((x + 2, 2), str(x), fill=(255, 255, 0, 255))
    for y in range(0, im.height, 50):
        d.line([(0, y), (im.width, y)], fill=(255, 0, 0, 120))
        d.text((2, y + 2), str(y), fill=(255, 255, 0, 255))
    im.save(pathlib.Path(__file__).parent / "_grid.png")
    print(f"wrote tools/_grid.png ({im.width}x{im.height})")


def erase_from(im: Image.Image, rect, sample_side: str):
    """Fill rect with ground color sampled just outside it, per row/column,
    so movable sprites are not baked into their parent layer."""
    x, y, w, h = rect
    if sample_side in ("left", "right"):
        sx = x - 5 if sample_side == "left" else x + w + 5
        for j in range(h):
            c = im.getpixel((sx, y + j))
            for i in range(w):
                im.putpixel((x + i, y + j), c)
    else:  # above / below
        sy = y - 5 if sample_side == "above" else y + h + 5
        for i in range(w):
            c = im.getpixel((x + i, sy))
            for j in range(h):
                im.putpixel((x + i, y + j), c)


def slice_all():
    im = Image.open(SRC).convert("RGBA")
    spec = json.loads(LAYERS.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    # erase movable sprites from the flattened source BEFORE slicing parents,
    # then slice the sprites themselves from the ORIGINAL pixels
    original = im.copy()
    for name, r in spec["layers"].items():
        if r.get("eraseFromParent"):
            erase_from(im, r["rect"], r.get("sampleSide", "left"))
    manifest = {}
    for name, r in spec["layers"].items():
        if r.get("noTile"):
            continue  # erased from parents only (e.g. the leaning broom — the keeper carries one now)
        x, y, w, h = r["rect"]
        src = original if r.get("eraseFromParent") else im
        tile = src.crop((x, y, x + w, y + h))
        if r.get("cutout"):
            # remove background by keying every color found on the tile border
            border = set()
            for i in range(tile.width):
                border.add(tile.getpixel((i, 0))[:3])
                border.add(tile.getpixel((i, tile.height - 1))[:3])
            for j in range(tile.height):
                border.add(tile.getpixel((0, j))[:3])
                border.add(tile.getpixel((tile.width - 1, j))[:3])
            tol = r.get("cutoutTolerance", 24)
            px = tile.load()
            for j in range(tile.height):
                for i in range(tile.width):
                    p = px[i, j]
                    if any(abs(p[0]-b[0]) + abs(p[1]-b[1]) + abs(p[2]-b[2]) < tol for b in border):
                        px[i, j] = (0, 0, 0, 0)
        if r.get("chroma"):  # remove flat sky color so shrine layers get transparency
            key = tuple(spec["skyColor"])
            tol = spec.get("chromaTolerance", 18)
            px = tile.load()
            for j in range(tile.height):
                for i in range(tile.width):
                    p = px[i, j]
                    if abs(p[0] - key[0]) + abs(p[1] - key[1]) + abs(p[2] - key[2]) < tol:
                        px[i, j] = (0, 0, 0, 0)
        if r.get("eraseSpecks"):
            # scrub bright warm specks (baked-in bugs/fireflies) so they can be
            # animated as live sprites instead; skip rects protect real flames
            skips = r["eraseSpecks"].get("skip", [])
            x0, y0 = r["rect"][0], r["rect"][1]
            px = tile.load()
            total = 0
            # multi-pass: fill samples can land inside a large blob, so erode until stable
            for _pass in range(10):
                erased = 0
                for j in range(tile.height):
                    for i in range(tile.width):
                        p = px[i, j]
                        # warm bright specks: orange bugs AND pale-gold bugs
                        if p[3] > 0 and p[0] > 190 and p[1] > 110 and p[0] > p[2] + 60:
                            sx, sy = x0 + i, y0 + j
                            if any(rx <= sx < rx + rw and ry <= sy < ry + rh for rx, ry, rw, rh in skips):
                                continue
                            px[i, j] = px[max(0, i - 6), min(tile.height - 1, j + 5)]
                            erased += 1
                total += erased
                if erased == 0:
                    break
            print(f"  eraseSpecks({name}): erased {total} px")
        if r.get("movePixelBlock"):
            # relocate a small block (e.g. misplaced moss): fill source area with the
            # color just left of it, stamp the block at its new home
            fx, fy, fw, fh = r["movePixelBlock"]["from"]
            tx, ty = r["movePixelBlock"]["to"]
            block = tile.crop((fx, fy, fx + fw, fy + fh))
            fill = tile.getpixel((fx - 2, fy + fh // 2))
            for j in range(fh):
                for i in range(fw):
                    tile.putpixel((fx + i, fy + j), fill)
            tile.paste(block, (tx, ty))
        tile.save(OUT / f"{name}.png")
        manifest[name] = {"rect": r["rect"], "z": r["z"]}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"sliced {len(manifest)} layers -> {OUT}")
    # post-step: re-extract the orange spirit's bundle (slicing regenerates his sprite)
    import subprocess
    subprocess.run([sys.executable, str(pathlib.Path(__file__).parent / "extract_bow.py")], check=True)


if __name__ == "__main__":
    grid() if "--grid" in sys.argv else slice_all()
