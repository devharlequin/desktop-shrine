"""Draw the clauding's 4-frame 16x16 sprite sheet (64x16): idle | step | bow | sleep."""
import pathlib

from PIL import Image

BODY = (216, 211, 200, 255)
EYES = (232, 163, 61, 255)
LINE = (58, 52, 80, 255)


def draw_base(im: Image.Image, ox: int, eyes: bool = True, squash: int = 0):
    """A small round-shouldered figure. squash lowers the top edge (sleeping)."""
    top, bot = 4 + squash, 14
    for x in range(3, 13):
        for y in range(top, bot + 1):
            im.putpixel((ox + x, y), BODY)
    # rounded shoulders: knock out corners
    for cx, cy in [(3, top), (12, top)]:
        im.putpixel((ox + cx, cy), (0, 0, 0, 0))
    # outline
    for x in range(4, 12):
        im.putpixel((ox + x, top), LINE)
    for x in range(3, 13):
        im.putpixel((ox + x, bot), LINE)
    for y in range(top + 1, bot):
        im.putpixel((ox + 3, y), LINE)
        im.putpixel((ox + 12, y), LINE)
    # eyes
    ey = 8 + squash
    if eyes:
        im.putpixel((ox + 6, ey), EYES)
        im.putpixel((ox + 9, ey), EYES)
    else:  # closed: a darker lid line
        im.putpixel((ox + 6, ey), (150, 145, 135, 255))
        im.putpixel((ox + 9, ey), (150, 145, 135, 255))
    # little feet
    im.putpixel((ox + 5, 15), LINE)
    im.putpixel((ox + 10, 15), LINE)


sheet = Image.new("RGBA", (64, 16), (0, 0, 0, 0))
draw_base(sheet, 0)                       # frame 0: idle
draw_base(sheet, 16)                      # frame 1: step (shift up 1px)
step = sheet.crop((16, 0, 32, 16))
sheet.paste(Image.new("RGBA", (16, 16), (0, 0, 0, 0)), (16, 0))
sheet.paste(step, (16, -1), step)
draw_base(sheet, 32)                      # frame 2: bow (head rows pushed down)
bow = sheet.crop((32, 0, 48, 16))
top = bow.crop((0, 0, 16, 9))
bow.paste(Image.new("RGBA", (16, 9), (0, 0, 0, 0)), (0, 0))
bow.paste(top, (0, 2), top)
sheet.paste(Image.new("RGBA", (16, 16), (0, 0, 0, 0)), (32, 0))
sheet.paste(bow, (32, 0), bow)
draw_base(sheet, 48, eyes=False, squash=1)  # frame 3: sleep

out = pathlib.Path(__file__).resolve().parents[1] / "public" / "sprites" / "clauding.png"
sheet.save(out)
print("wrote", out)
