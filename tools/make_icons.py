#!/usr/bin/env python3
"""Iconos de «Mi plato»: plato blanco con marca de check sobre violeta intenso (sin texto, con margen maskable)."""
from PIL import Image, ImageDraw, ImageFilter
import os

S = 2048
img = Image.new("RGB", (S, S))
px = img.load()
top, bot = (132, 84, 240), (74, 32, 176)
for y in range(S):
    t = y / (S - 1)
    c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(S):
        px[x, y] = c
cx = cy = S / 2
W = (255, 255, 255)
layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ld = ImageDraw.Draw(layer)
R = 560  # radio del plato (zona segura ≈ 60 %)
ld.ellipse((cx - R, cy - R, cx + R, cy + R), fill=W)
# hueco interior (borde del plato)
r2 = 410
ld.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), fill=(0, 0, 0, 0))
ld.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), outline=None)
# interior un poco tintado para dar profundidad al plato
inner = Image.new("RGBA", (S, S), (0, 0, 0, 0))
idr = ImageDraw.Draw(inner)
idr.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), fill=(236, 228, 255, 255))
# check
ck = Image.new("RGBA", (S, S), (0, 0, 0, 0))
cd = ImageDraw.Draw(ck)
pts = [(cx - 190, cy + 5), (cx - 55, cy + 150), (cx + 205, cy - 135)]
cd.line(pts, fill=(98, 52, 208, 255), width=84, joint="curve")
for p in (pts[0], pts[2]):
    cd.ellipse((p[0] - 42, p[1] - 42, p[0] + 42, p[1] + 42), fill=(98, 52, 208, 255))
base = Image.alpha_composite(layer, inner)
base = Image.alpha_composite(base, ck)
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
shadow.paste((30, 0, 90, 95), mask=layer.split()[3])
shadow = shadow.filter(ImageFilter.GaussianBlur(30)).transform((S, S), Image.AFFINE, (1, 0, 0, 0, 1, -20))
img = Image.alpha_composite(img.convert("RGBA"), shadow)
img = Image.alpha_composite(img, base).convert("RGB")
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, name), optimize=True)
print("ok")
