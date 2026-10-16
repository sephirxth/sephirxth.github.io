#!/usr/bin/env python3
"""Insert (or replace) the Cloudflare Web Analytics beacon in every page of the site.

Usage: add_cf_beacon.py <site-root> <token> [--dry-run]
Skips redirect-only pages (meta refresh). Idempotent: an existing block between the
markers is replaced, so rerunning with a new token just swaps it.
"""
import pathlib, re, sys

START, END = "<!-- Cloudflare Web Analytics -->", "<!-- End Cloudflare Web Analytics -->"

def block(token: str) -> str:
    return (f"{START}<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' "
            f"data-cf-beacon='{{\"token\": \"{token}\"}}'></script>{END}\n")

def main():
    root, token = pathlib.Path(sys.argv[1]), sys.argv[2]
    dry = "--dry-run" in sys.argv
    if not re.fullmatch(r"[0-9a-f]{32}", token):
        sys.exit(f"token does not look like a CF beacon token: {token!r}")
    done = skipped = 0
    for p in sorted(root.rglob("*.html")):
        if ".git" in p.parts or "tools" in p.parts:
            continue
        s = p.read_text(encoding="utf-8")
        if re.search(r'http-equiv=["\']?refresh', s, re.I):
            skipped += 1; continue
        if START in s:
            s2 = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", block(token), s, flags=re.S)
        elif "</body>" in s:
            s2 = s.replace("</body>", block(token) + "</body>", 1)
        else:
            print("no </body>:", p); continue
        if s2 != s:
            done += 1
            if not dry:
                p.write_text(s2, encoding="utf-8")
    print(f"pages updated: {done}, redirect pages skipped: {skipped}{' (dry run)' if dry else ''}")

if __name__ == "__main__":
    main()
