#!/usr/bin/env python3
"""Animate the existing Rule 110 plate. Requires Pillow.

    python3 tools/animate_rule110.py

The first frame matches plate-rule110.png. Later frames advance the time-space
window by one generation, using the same rule, seed, crop and two-colour palette
as tools/art.py. Native 200 x 150 pixels preserve the site's integer-scale art.
"""
from pathlib import Path
from PIL import Image
from art import OLIVE, elementary_ca


def main():
    width, height, size, start, count = 200, 150, 640, 330, 80
    first = [0] * size
    first[-1] = 1
    rows = elementary_ca(110, size, start + height + count - 1, first)
    palette = [channel for color in OLIVE for channel in color]
    frames = []
    for generation in range(count):
        frame = Image.new("P", (width, height))
        frame.putpalette(palette)
        frame.putdata([cell for row in rows[start + generation:start + generation + height]
                       for cell in row[size - 20 - width:size - 20]])
        frames.append(frame)
    output = Path(__file__).resolve().parent.parent / "assets/img/plate-rule110.gif"
    frames[0].save(output, save_all=True, append_images=frames[1:], duration=120,
                   loop=0, optimize=True)
    print(f"{output.name}: {count} frames, {width}x{height}, {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
