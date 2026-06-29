#!/usr/bin/env python3
"""
Build-time generator for the fog-of-war cloud texture.

Produces a *seamlessly tileable* cloud PNG that MapLibre repeats across the fog
mask polygon (`fill-pattern`). The fog mask itself stays a single feature, so
this texture is what turns the flat hex-edged mask into a sky of clouds at zero
per-cell render cost.

The cloud shape is the app's own silhouette — the `CLOUD` clip-path from
`src/features/map/FogLayer.tsx` (and the CloudFace mascot) — rasterized here, so
the fog matches the rest of the UI.

Look: a regular fish-scale tessellation. Clouds sit on a brick grid and each row
overlaps the row above by ~half, so only the rounded bumps show — clouds nesting
like scales. There is no background: the rows fully cover the tile. Each cloud is
filled with a vertical gradient (light at the top of the bumps, darker lavender
at the bottom); drawn back-to-front, the dark bottom of one row peeks just above
the light top of the next, which is what gives the soft scalloped shading in the
valleys — no harsh drop-shadows.

Seamless by construction: the grid period divides the tile in both axes (even row
count so the brick offset matches across the seam) and rows/cols are drawn one
past each edge, so the pattern wraps with no visible seam however many times
MapLibre tiles it. Palette is tied to theme `colors.fogGradient`.

Usage:  python3 scripts/buildCloudTile.py
Output: assets/cloud-tile.png  (512x512, RGBA, opaque)
"""
import os
import re

from PIL import Image, ImageDraw, ImageFilter

SIZE = 512          # tile is square
NCOLS = 8           # clouds per row (more cols = smaller clouds)
ROW_OVERLAP = 0.52  # row vertical step as a fraction of cloud height (<1 = nest)
COL_OVERLAP = 1.16  # cloud width as a multiple of column step (>1 = no gaps)

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "cloud-tile.png")

# Palette (sRGB) — tied to colors.fogGradient. Light bump tops -> darker valleys.
TOP = (0xF5, 0xF4, 0xFC)         # near-white lavender, lit cloud tops
BOT = (0xD2, 0xCF, 0xE8)         # soft lavender, shaded undersides / valleys

# The app's cloud silhouette, verbatim from FogLayer.tsx (authored in a 72x80
# box). Format: M x,y  then cubic Béziers (C c1 c2 end)+  then L x,y  then Z.
CLOUD_PATH = (
    "M14,74 C4,74 1,62 8,55 C1,48 6,33 16,37 C17,20 32,16 38,28 "
    "C43,10 60,10 64,26 C75,22 79,40 70,48 C78,54 74,70 62,72 L62,74 Z"
)


def cloud_polygon(steps=28):
    """Flatten the cubic-Bézier CLOUD path into (x, y) points normalized so its
    bounding box maps to the unit square [0,1]x[0,1]."""
    toks = re.findall(r"[MCLZ]|-?\d+\.?\d*", CLOUD_PATH)
    i = 0
    pts = []
    cur = (0.0, 0.0)
    start = (0.0, 0.0)

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        cmd = toks[i]
        i += 1
        if cmd == "M":
            cur = (num(), num())
            start = cur
            pts.append(cur)
        elif cmd == "C":
            p0 = cur
            c1 = (num(), num())
            c2 = (num(), num())
            p3 = (num(), num())
            for s in range(1, steps + 1):
                t = s / steps
                mt = 1 - t
                x = (mt**3 * p0[0] + 3 * mt**2 * t * c1[0]
                     + 3 * mt * t**2 * c2[0] + t**3 * p3[0])
                y = (mt**3 * p0[1] + 3 * mt**2 * t * c1[1]
                     + 3 * mt * t**2 * c2[1] + t**3 * p3[1])
                pts.append((x, y))
            cur = p3
        elif cmd == "L":
            cur = (num(), num())
            pts.append(cur)
        elif cmd == "Z":
            pts.append(start)

    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    w, h = maxx - minx, maxy - miny
    return [((p[0] - minx) / w, (p[1] - miny) / h) for p in pts]


def gradient_column(h):
    """A 1xh vertical TOP->BOT gradient, resized per-cloud to fill a polygon."""
    col = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        col.putpixel((0, y), tuple(round(TOP[i] + (BOT[i] - TOP[i]) * t)
                                   for i in range(3)) + (255,))
    return col


def stamp_cloud(img, poly):
    """Paste one gradient-filled cloud onto `img` at its true position. Opaque +
    back-to-front draw order means later (lower) rows simply cover earlier ones."""
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    minx, miny = int(min(xs)) - 1, int(min(ys)) - 1
    maxx, maxy = int(max(xs)) + 2, int(max(ys)) + 2
    w, h = maxx - minx, maxy - miny
    if w <= 0 or h <= 0:
        return

    # Soft-edged mask of the silhouette, and a TOP->BOT gradient to fill it.
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon([(x - minx, y - miny) for (x, y) in poly], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    grad = gradient_column(h).resize((w, h))
    img.paste(grad, (minx, miny), mask)


def main():
    base_poly = cloud_polygon()

    col_step = SIZE / NCOLS
    cw = col_step * COL_OVERLAP
    ch = cw * 0.82
    # Force an even row count so the brick (half-column) offset lines up across
    # the top/bottom seam, keeping the tile seamless.
    nrows = max(2, round(SIZE / (ch * ROW_OVERLAP)))
    if nrows % 2:
        nrows += 1
    row_step = SIZE / nrows

    img = Image.new("RGBA", (SIZE, SIZE), BOT + (255,))

    # Draw back-to-front (top rows first), one row/col past every edge so the
    # nesting overlaps wrap seamlessly.
    for r in range(-2, nrows + 2):
        offset = (col_step / 2) if (r % 2) else 0.0
        cy = r * row_step
        for c in range(-1, NCOLS + 1):
            cx = c * col_step + offset + col_step / 2
            poly = [(cx + (px - 0.5) * cw, cy + (py - 0.5) * ch)
                    for (px, py) in base_poly]
            stamp_cloud(img, poly)

    img = img.convert("RGBA")  # tile stays fully opaque

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "PNG")
    print(f"wrote {os.path.relpath(OUT)}  ({SIZE}x{SIZE}, seamless, "
          f"{NCOLS}x{nrows} scales)")


if __name__ == "__main__":
    main()
