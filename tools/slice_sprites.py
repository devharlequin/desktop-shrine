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


def slice_all():
    im = Image.open(SRC).convert("RGBA")
    spec = json.loads(LAYERS.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, r in spec["layers"].items():
        x, y, w, h = r["rect"]
        tile = im.crop((x, y, x + w, y + h))
        if r.get("chroma"):  # remove flat sky color so shrine layers get transparency
            key = tuple(spec["skyColor"])
            tol = spec.get("chromaTolerance", 18)
            px = tile.load()
            for j in range(tile.height):
                for i in range(tile.width):
                    p = px[i, j]
                    if abs(p[0] - key[0]) + abs(p[1] - key[1]) + abs(p[2] - key[2]) < tol:
                        px[i, j] = (0, 0, 0, 0)
        tile.save(OUT / f"{name}.png")
        manifest[name] = {"rect": r["rect"], "z": r["z"]}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"sliced {len(manifest)} layers -> {OUT}")


if __name__ == "__main__":
    grid() if "--grid" in sys.argv else slice_all()
