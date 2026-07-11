"""Draw the keeper's little broom (12x18), palette matched to the source art."""
import pathlib

from PIL import Image

HANDLE = (154, 106, 62, 255)
HANDLE_HI = (186, 134, 82, 255)
TIE = (106, 74, 46, 255)
BRISTLE = (224, 176, 80, 255)
BRISTLE_HI = (240, 200, 110, 255)

im = Image.new("RGBA", (12, 18), (0, 0, 0, 0))
# diagonal handle, 2px wide, from top-right to lower-left
for i in range(10):
    x = 8 - i // 2
    y = 1 + i
    im.putpixel((x, y), HANDLE_HI if i % 3 == 0 else HANDLE)
    im.putpixel((x + 1, y), HANDLE)
# tie
im.putpixel((3, 11), TIE)
im.putpixel((4, 11), TIE)
im.putpixel((5, 11), TIE)
# bristle fan
for y in range(12, 17):
    spread = y - 10
    for x in range(4 - spread // 2 - 1, 5 + spread // 2 + 1):
        if 0 <= x < 12:
            im.putpixel((x, y), BRISTLE_HI if (x + y) % 4 == 0 else BRISTLE)

out = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites" / "broom.png"
im.save(out)
print("wrote", out)
