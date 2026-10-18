#!/usr/bin/env python3
"""Insert (or replace, or remove) the Google Analytics 4 tag (gtag.js) in every page of the site.

Usage:
  add_ga.py <site-root> <measurement-id> [--dry-run]
  add_ga.py <site-root> --remove [--dry-run]

  measurement-id   the GA4 "Measurement ID" (Admin -> Data streams -> Web), e.g. G-ABC123DEF4;
                   public, it ends up in page source anyway

Google's standard gtag.js snippet goes right after the opening <head> tag, which is where Google
asks for it; having it inside <head> also lets Google Search Console verify site ownership with the
"Google Analytics" method.

Written after add_umami.py / tools/add_cf_beacon.py in the site repo: skips redirect-only pages
(meta refresh), .git and tools/; idempotent: an existing block between the markers is replaced, so
rerunning with a new ID just swaps it. Line endings are kept: the block uses the file's own newline.
"""
import pathlib, re, sys

START, END = "<!-- Google Analytics -->", "<!-- End Google Analytics -->"
BLOCK_RE = re.compile(re.escape(START) + r".*?" + re.escape(END) + r"(\r\n|\n)?", re.S)
ID_RE = re.compile(r"G-[A-Z0-9]{4,15}")
HEAD_RE = re.compile(r"<head(\s[^>]*)?>(\r\n|\n)?", re.I)


def block(mid: str, nl: str) -> str:
    lines = [
        START,
        "<!-- Google tag (gtag.js) -->",
        f'<script async src="https://www.googletagmanager.com/gtag/js?id={mid}"></script>',
        "<script>",
        "  window.dataLayer = window.dataLayer || [];",
        "  function gtag(){dataLayer.push(arguments);}",
        "  gtag('js', new Date());",
        "",
        f"  gtag('config', '{mid}');",
        "</script>",
        END,
    ]
    return nl.join(lines) + nl


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    remove = "--remove" in args
    args = [a for a in args if a not in ("--dry-run", "--remove")]
    if not args or args[0].startswith("-"):
        sys.exit(__doc__)
    root = pathlib.Path(args[0])
    if not root.is_dir():
        sys.exit(f"not a directory: {root}")

    mid = None
    if not remove:
        if len(args) != 2:
            sys.exit(__doc__)
        mid = args[1].strip()
        if not ID_RE.fullmatch(mid):
            sys.exit(f"measurement-id must look like G-XXXXXXXX (^G-[A-Z0-9]{{4,15}}$): {mid!r}")

    changed, skipped, unchanged, nohead = [], 0, 0, []
    for p in sorted(root.rglob("*.html")):
        rel = p.relative_to(root)
        if ".git" in rel.parts or "tools" in rel.parts:
            continue
        with open(p, encoding="utf-8", newline="") as f:
            s = f.read()
        if re.search(r'http-equiv=["\']?refresh', s, re.I):
            skipped += 1
            continue
        nl = "\r\n" if "\r\n" in s else "\n"
        has = START in s
        if remove:
            s2 = BLOCK_RE.sub("", s) if has else s
        elif has:
            new = block(mid, nl)
            s2 = BLOCK_RE.sub(lambda m: new, s, count=1)
        else:
            m = HEAD_RE.search(s)
            if not m:
                nohead.append(str(rel))
                continue
            new = block(mid, nl)
            # right after <head>: keep the tag's own line break, or add one if <head> shares a line
            ins = new if m.group(2) else nl + new
            s2 = s[:m.end()] + ins + s[m.end():]
        if s2 == s:
            unchanged += 1
            continue
        changed.append(str(rel))
        if not dry:
            with open(p, "w", encoding="utf-8", newline="") as f:
                f.write(s2)

    for r in changed:
        print(("would change: " if dry else "changed: ") + r)
    for r in nohead:
        print("no <head>, left alone:", r)
    verb = "removed from" if remove else "updated"
    print(f"pages {verb}: {len(changed)}, already up to date: {unchanged}, "
          f"redirect pages skipped: {skipped}{' (dry run)' if dry else ''}")


if __name__ == "__main__":
    main()
