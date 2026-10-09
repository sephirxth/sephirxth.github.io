#!/usr/bin/env python3
"""Draw the site's 1-bit pictures. No dependencies; writes 1-bit paletted PNGs.

    python3 tools/art.py            # regenerate everything under assets/img/

Every picture is two colours (one dark, one light) and is meant to be shown at
an integer scale with `image-rendering: pixelated`.
"""
import math
import os
import random
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "img")

# two-colour palettes: (dark, light)
OLIVE = ((0x33, 0x33, 0x19), (0xE5, 0xFF, 0xFF))   # dark olive / pale cyan
SLATE = ((0x3A, 0x3D, 0x4B), (0xC7, 0xDF, 0xE8))   # slate / pale blue
PAPER = ((0x1B, 0x1B, 0x1B), (0xEF, 0xEE, 0xE9))   # ink / paper
PLAIN = ((0x11, 0x11, 0x11), (0xFF, 0xFF, 0xFF))   # black / white

BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
]


def write_png(path, bits, palette):
    """bits: rows of 0 (dark) / 1 (light)."""
    h, w = len(bits), len(bits[0])
    raw = bytearray()
    for row in bits:
        raw.append(0)
        byte, n = 0, 0
        for v in row:
            byte = (byte << 1) | (1 if v else 0)
            n += 1
            if n == 8:
                raw.append(byte)
                byte, n = 0, 0
        if n:
            raw.append(byte << (8 - n))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 1, 3, 0, 0, 0))
    png += chunk(b"PLTE", bytes(palette[0]) + bytes(palette[1]))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print(f"{os.path.relpath(path)}  {w}x{h}  {len(png)} bytes")


def dither(gray):
    """gray: rows of floats 0..1 -> rows of 0/1 with an 8x8 ordered dither."""
    return [[1 if v > (BAYER8[y % 8][x % 8] + 0.5) / 64 else 0 for x, v in enumerate(row)]
            for y, row in enumerate(gray)]


def line(bits, x0, y0, x1, y1, v=0):
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        if 0 <= y0 < len(bits) and 0 <= x0 < len(bits[0]):
            bits[y0][x0] = v
        if x0 == x1 and y0 == y1:
            return
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def fill_poly(bits, pts, v=0):
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys))), min(len(bits), int(max(ys)) + 1)):
        xs = []
        for i in range(len(pts)):
            (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % len(pts)]
            if ya == yb:
                continue
            if min(ya, yb) <= y < max(ya, yb):
                xs.append(xa + (y - ya) * (xb - xa) / (yb - ya))
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            for x in range(max(0, int(round(a))), min(len(bits[0]), int(round(b)) + 1)):
                bits[y][x] = v


# ---------------------------------------------------------------- pictures

def elementary_ca(rule, w, h, first=None):
    row = first or [0] * w
    rows = []
    for _ in range(h):
        rows.append(row)
        row = [(rule >> ((row[(x - 1) % w] << 2) | (row[x] << 1) | row[(x + 1) % w])) & 1 for x in range(w)]
    return rows


def icon_ca():
    """Rule 90 from a single cell: the small mark in the page corner."""
    w, h = 31, 16
    first = [0] * w
    first[w // 2] = 1
    rows = elementary_ca(90, w, h, first)
    write_png(os.path.join(OUT, "mark-rule90.png"), [[0 if c else 1 for c in r] for r in rows], PLAIN)


def plate_emergence():
    """Rule 110 grown from one cell: local rules, structure nobody wrote down."""
    w, h = 200, 150
    big = 640
    first = [0] * big
    first[big - 1] = 1
    rows = elementary_ca(110, big, 330 + h, first)[330:]
    write_png(os.path.join(OUT, "plate-rule110.png"),
              [[1 if c else 0 for c in r[big - 20 - w:big - 20]] for r in rows], OLIVE)


def plate_ship():
    """A ship against the moon; one stretch of hull planking is new."""
    w, h = 200, 150
    horizon = 108
    mx, my, mr = 124, 50, 24
    rnd = random.Random(11)
    gray = [[0.0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - mx, y - my)
            if y < horizon:
                g = 0.02 + 0.62 * math.exp(-(d / 58) ** 2)
                g += 0.10 * max(0.0, math.sin(y * 0.42 + math.sin(x * 0.03) * 1.6)) * math.exp(-((y - 78) / 14) ** 2)
                if d <= mr:
                    g = 1.0
            else:
                t = (y - horizon) / (h - horizon)
                spread = 9 + 30 * t
                wave = 0.5 + 0.5 * math.sin(y * 1.9 + math.sin(x * 0.21) * 1.3)
                g = 0.03 + 0.85 * math.exp(-((x - mx) / spread) ** 2) * wave
                g += 0.07 * max(0.0, math.sin(y * 1.1 + x * 0.07)) * (1 - t)
            gray[y][x] = max(0.0, min(1.0, g))
    bits = dither(gray)
    for _ in range(22):                       # stars, away from the glow
        x, y = rnd.randrange(w), rnd.randrange(6, horizon - 40)
        if math.hypot(x - mx, y - my) > 72:
            bits[y][x] = 1
    for x in range(w):                        # horizon
        bits[horizon][x] = 0

    def sail(cx, y0, y1, hw0, hw1):
        fill_poly(bits, [(cx - hw0, y0), (cx + hw0, y0), (cx + hw1, y1), (cx - hw1, y1)], 0)
        line(bits, cx - hw0 - 2, y0 - 1, cx + hw0 + 2, y0 - 1, 0)      # yard

    # hull, bow to the left
    fill_poly(bits, [(50, 95), (57, 98), (126, 98), (128, 91), (143, 91), (140, 107), (61, 107), (54, 101)], 0)
    line(bits, 50, 95, 29, 86, 0)             # bowsprit
    for cx, top in ((74, 40), (98, 28), (121, 42)):
        line(bits, cx, 98, cx, top, 0)        # masts
    sail(74, 80, 94, 12, 14)
    sail(74, 63, 77, 10, 12)
    sail(74, 49, 60, 7, 9)
    sail(98, 78, 94, 14, 16)
    sail(98, 57, 75, 12, 14)
    sail(98, 39, 54, 8, 10)
    sail(121, 60, 70, 8, 9)
    sail(121, 49, 57, 6, 7)
    fill_poly(bits, [(122, 73), (139, 78), (137, 90), (122, 90)], 0)   # spanker
    fill_poly(bits, [(33, 87), (60, 56), (62, 88)], 0)                 # jib
    line(bits, 29, 86, 74, 42, 0)             # stays
    line(bits, 29, 86, 98, 30, 0)
    line(bits, 121, 42, 143, 91, 0)
    # the new planks: a lighter stretch of hull
    for y in range(100, 105):
        for x in range(84, 110):
            if (x + y) % 2 == 0:
                bits[y][x] = 1
    bits[88][141] = 1                          # stern lantern
    bits[89][141] = 1
    for y in range(109, 114):                  # the hull's shadow on the water
        for x in range(60 + (y - 109), 138 - (y - 109)):
            if (x + y) % 3:
                bits[y][x] = 0
    write_png(os.path.join(OUT, "plate-ship.png"), bits, SLATE)
    # the same picture six times larger, for link previews
    big = [[v for v in row for _ in range(6)] for row in bits for _ in range(6)]
    write_png(os.path.join(OUT, "share-ship.png"), big, SLATE)


def plate_traffic():
    """Time-space diagram of one lane carrying traffic in both directions.

    Time runs left to right, position bottom to top. Solid lines climb, dashed
    lines descend. The two directions cross only inside the lay-bys (dotted
    bands): with a block travel time T and departures every 2T from both ends,
    every meeting falls on a lay-by.
    """
    w, h = 200, 150
    bits = [[1] * w for _ in range(h)]
    left, right, top, bottom = 14, 192, 14, 134
    block = (bottom - top) / 4.0              # road length between passing places
    T = 30.0                                  # time to drive one block
    slope = block / T
    bays = [bottom - block * i for i in (1, 2, 3)]
    for by in bays:                           # lay-bys: dotted bands
        for y in range(int(by) - 5, int(by) + 6):
            for x in range(left + 1, right + 1):
                if (x % 4 == 0 and y % 2 == 0) and (y - int(by)) % 4 != 1:
                    bits[y][x] = 0
    offsets = (0, 5, 10)                      # three vehicles per platoon
    for k in range(-3, 5):
        for o in offsets:
            t0 = left + k * 2 * T + o + 4
            # climbing vehicle: solid
            line(bits, t0, bottom, t0 + 4 * T, top, 0)
            # descending vehicle: dashed
            x0, y0, x1, y1 = t0, top, t0 + 4 * T, bottom
            steps = int(4 * T)
            for s_ in range(steps + 1):
                if s_ % 4 < 2:
                    px = int(round(x0 + (x1 - x0) * s_ / steps))
                    py = int(round(y0 + (y1 - y0) * s_ / steps))
                    if 0 <= py < h and 0 <= px < w:
                        bits[py][px] = 0
    for y in range(h):                        # keep the plot area only
        for x in range(w):
            if x <= left or x > right or y < top or y > bottom:
                bits[y][x] = 1
    line(bits, left, top - 5, left, bottom, 0)
    line(bits, left, bottom, right + 5, bottom, 0)
    for i in range(1, 6):                     # time ticks
        x = int(left + i * T + 4)
        if x < right:
            bits[bottom + 1][x] = 0
            bits[bottom + 2][x] = 0
    for by in bays:                           # position ticks
        bits[int(by)][left - 1] = 0
        bits[int(by)][left - 2] = 0
    write_png(os.path.join(OUT, "plate-timespace.png"), bits, PAPER)


def rule_strip():
    """A 50% checker tile, used as a thin band above the page foot."""
    write_png(os.path.join(OUT, "rule-dither.png"), [[(x + y) % 2 for x in range(8)] for y in range(2)], PLAIN)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    icon_ca()
    plate_emergence()
    plate_ship()
    plate_traffic()
    rule_strip()
