#!/usr/bin/env python3
"""The drawing kit behind tools/figs.py: a small SVG builder and the code that
puts the drawings into the pages. No dependencies.

A page holds a figure between two marker comments:

    <!-- fig:flow-loop:zh -->
    ...svg...
    <!-- /fig -->

and this script replaces what is between them. The figures share one look: ink
lines one pixel wide on a paper-coloured panel, areas filled with 1-bit dither
patterns, labels set in the page's own fonts (which is why the SVG is inline).
Every figure is drawn at a fixed size, 880 px wide, on whole pixels.
"""
import glob
import html
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
INK, SOFT, FAINT, HAIR, PAPER, WHITE = "#1b1b1b", "#555", "#8d8d8d", "#b9b9b9", "#efeee9", "#fff"
W = 880


class Svg:
    """A tiny SVG builder that keeps one-pixel lines crisp."""

    def __init__(self, h, w=W, title=""):
        self.w, self.h, self.title, self.out = w, h, title, []
        self.rect(0, 0, w, h, fill=PAPER, stroke=None)

    # -- primitives ---------------------------------------------------------
    def add(self, s):
        self.out.append(s)

    def line(self, x1, y1, x2, y2, color=INK, width=1, dash=None):
        off = 0.5 if width % 2 else 0
        if x1 == x2:
            x1 = x2 = x1 + off
        elif y1 == y2:
            y1 = y2 = y1 + off
        d = f' stroke-dasharray="{dash}"' if dash else ""
        crisp = ' shape-rendering="crispEdges"' if (x1 == x2 or y1 == y2) else ""
        self.add(f'<line x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}" stroke="{color}" stroke-width="{width}"{d}{crisp}/>')

    def path(self, pts, color=INK, width=1, dash=None, fill="none", close=False):
        d = "M" + " L".join(f"{x:g} {y:g}" for x, y in pts) + (" Z" if close else "")
        da = f' stroke-dasharray="{dash}"' if dash else ""
        st = f'stroke="{color}" stroke-width="{width}"' if color else 'stroke="none"'
        self.add(f'<path d="{d}" fill="{fill}" {st}{da} stroke-linejoin="round" stroke-linecap="round"/>')

    def rect(self, x, y, w, h, fill="none", stroke=INK, width=1, dash=None):
        if stroke:
            d = f' stroke-dasharray="{dash}"' if dash else ""
            self.add(f'<rect x="{x + .5:g}" y="{y + .5:g}" width="{w - 1:g}" height="{h - 1:g}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"{d} shape-rendering="crispEdges"/>')
        else:
            self.add(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="{fill}" shape-rendering="crispEdges"/>')

    def dither(self, x, y, w, h, level=50, stroke=None):
        """A rectangle filled with a 1-bit pattern: level 12, 25, 50 or 75 per cent ink."""
        self.rect(x, y, w, h, fill=f"url(#d{level})", stroke=stroke)

    def poly(self, pts, fill=INK, stroke=None):
        p = " ".join(f"{x:g},{y:g}" for x, y in pts)
        st = f' stroke="{stroke}" stroke-width="1"' if stroke else ""
        self.add(f'<polygon points="{p}" fill="{fill}"{st}/>')

    def circle(self, x, y, r, fill=PAPER, stroke=INK):
        st = f' stroke="{stroke}" stroke-width="1"' if stroke else ""
        self.add(f'<circle cx="{x:g}" cy="{y:g}" r="{r:g}" fill="{fill}"{st}/>')

    def text(self, x, y, s, cls="", anchor="start", color=None):
        c = f' class="{cls}"' if cls else ""
        f = f' fill="{color}"' if color else ""
        a = f' text-anchor="{anchor}"' if anchor != "start" else ""
        self.add(f'<text x="{x:g}" y="{y:g}"{c}{a}{f}>{html.escape(s, quote=False)}</text>')

    def lines(self, x, y, rows, cls="", anchor="start", lh=17, color=None):
        """Several lines of text; a string is split on '\\n'."""
        if isinstance(rows, str):
            rows = rows.split("\n")
        for i, s in enumerate(rows):
            self.text(x, y + i * lh, s, cls, anchor, color)

    # -- composites ---------------------------------------------------------
    def arrow(self, x1, y1, x2, y2, color=INK, dash=None, head=7):
        """A straight arrow along one axis, with a small solid head."""
        self.line(x1, y1, x2, y2, color, dash=dash)
        if x1 == x2:
            s = 1 if y2 > y1 else -1
            self.poly([(x2 + .5, y2), (x2 + .5 - 4, y2 - s * head), (x2 + .5 + 4, y2 - s * head)], color)
        else:
            s = 1 if x2 > x1 else -1
            self.poly([(x2, y2 + .5), (x2 - s * head, y2 + .5 - 4), (x2 - s * head, y2 + .5 + 4)], color)

    def elbow(self, pts, color=INK, dash=None, head=7):
        """An arrow made of horizontal and vertical pieces."""
        for (xa, ya), (xb, yb) in zip(pts[:-2], pts[1:-1]):
            self.line(xa, ya, xb, yb, color, dash=dash)
        (xa, ya), (xb, yb) = pts[-2], pts[-1]
        self.arrow(xa, ya, xb, yb, color, dash, head)

    def box(self, x, y, w, h, title, sub=None, fill=WHITE, tcls="t-node", scls="t-small t-soft", shade=None):
        """A node: a frame with a title and an optional second line (or lines)."""
        if shade:
            self.dither(x + 4, y + 4, w, h, shade)
        self.rect(x, y, w, h, fill=fill)
        rows = [] if sub is None else (sub.split("\n") if isinstance(sub, str) else list(sub))
        total = 18 + 16 * len(rows)
        ty = y + (h - total) / 2 + 15
        self.text(x + w / 2, ty, title, tcls, "middle")
        for i, s in enumerate(rows):
            self.text(x + w / 2, ty + 19 + i * 16, s, scls, "middle")

    def label(self, x, y, s, anchor="start"):
        """A small capital label, used for axis names and section tags."""
        self.text(x, y, s, "t-caps", anchor)

    def render(self):
        defs = (
            '<defs>'
            f'<pattern id="d50" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="{INK}"/><rect x="2" y="2" width="2" height="2" fill="{INK}"/></pattern>'
            f'<pattern id="d25" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="{INK}"/></pattern>'
            f'<pattern id="d12" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="{INK}"/><rect x="4" y="4" width="2" height="2" fill="{INK}"/></pattern>'
            f'<pattern id="d6" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="{INK}"/></pattern>'
            f'<pattern id="d75" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="{INK}"/><rect x="2" width="2" height="2" fill="{PAPER}"/></pattern>'
            '</defs>'
        )
        t = f"<title>{html.escape(self.title)}</title>" if self.title else ""
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img">'
                + t + defs + "".join(self.out) + "</svg>")


# ====================================================================== figures
# Each figure is a function of the language ("zh" or "en") that returns an Svg.
# Words live in a small table at the top of the function so the two languages
# stay side by side.

FIGS = {}


def fig(name):
    def deco(fn):
        FIGS[name] = fn
        return fn
    return deco


def T(lang, zh, en):
    return zh if lang == "zh" else en


# ---------------------------------------------------------------- injection

MARK = re.compile(r"(<!-- fig:([a-z0-9-]+):(zh|en) -->)(.*?)(<!-- /fig -->)", re.S)


def inject(paths=None):
    paths = paths or glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True)
    n = 0
    for p in sorted(paths):
        s = open(p, encoding="utf-8").read()
        if "<!-- fig:" not in s:
            continue

        def repl(m):
            name, lang = m.group(2), m.group(3)
            if name not in FIGS:
                raise SystemExit(f"{p}: unknown figure {name}")
            return m.group(1) + "\n" + FIGS[name](lang).render() + "\n" + m.group(5)

        t = MARK.sub(repl, s)
        if t != s:
            open(p, "w", encoding="utf-8").write(t)
        k = len(MARK.findall(s))
        n += k
        print(f"{os.path.relpath(p, ROOT)}: {k} figure(s)")
    print(f"{n} figure(s) drawn")


def main():
    if "--list" in sys.argv:
        print("\n".join(sorted(FIGS)))
    else:
        inject([a for a in sys.argv[1:] if not a.startswith("--")] or None)
