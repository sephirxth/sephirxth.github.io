#!/usr/bin/env python3
"""Insert (or replace, or remove) the Umami tracker tag in every page of the site.

Usage:
  add_umami.py <site-root> <website-id> <script-url> [--domains D[,D2]] [--dry-run]
  add_umami.py <site-root> --remove [--dry-run]

  website-id   the UUID Umami shows after "Add website" (public; it ends up in page source anyway)
  script-url   full https URL of the renamed tracker, e.g. https://nas.tail17a64.ts.net/glyph.js
               data-host-url is derived from it (scheme://host[:port]); the tracker posts to
               <host-url>/api/glyph (COLLECT_API_ENDPOINT on the server)
  --domains    only count visits on these hostnames (Umami data-domains);
               default sephirxth.github.io, pass --domains "" to leave it out

Written after tools/add_cf_beacon.py in the site repo: skips redirect-only pages (meta refresh),
.git, tools/, and standalone demos/; inserts right before </body>; idempotent: an existing block between the markers
is replaced, so rerunning with a new ID/URL just swaps it. Line endings are kept as they are.
"""
import pathlib, re, sys
from urllib.parse import urlsplit

START, END = "<!-- Umami -->", "<!-- End Umami -->"
BLOCK_RE = re.compile(re.escape(START) + r".*?" + re.escape(END) + r"\n?", re.S)
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
HOST_RE = re.compile(r"[A-Za-z0-9.-]+(:[0-9]{1,5})?")


def block(website_id: str, script_url: str, host_url: str, domains: str) -> str:
    dom = f' data-domains="{domains}"' if domains else ""
    return (f'{START}<script defer src="{script_url}" data-website-id="{website_id}" '
            f'data-host-url="{host_url}"{dom}></script>{END}\n')


def take_opt(args, name):
    if name not in args:
        return None
    i = args.index(name)
    if i + 1 >= len(args):
        sys.exit(f"{name} needs a value")
    val = args[i + 1]
    del args[i:i + 2]
    return val


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    remove = "--remove" in args
    args = [a for a in args if a not in ("--dry-run", "--remove")]
    domains = take_opt(args, "--domains")
    if domains is None:
        domains = "sephirxth.github.io"
    if not args or args[0].startswith("-"):
        sys.exit(__doc__)
    root = pathlib.Path(args[0])
    if not root.is_dir():
        sys.exit(f"not a directory: {root}")

    new = None
    if not remove:
        if len(args) != 3:
            sys.exit(__doc__)
        website_id, script_url = args[1].strip().lower(), args[2].strip()
        if not UUID_RE.fullmatch(website_id):
            sys.exit(f"website-id does not look like a UUID: {website_id!r}")
        u = urlsplit(script_url)
        if u.scheme != "https" or not HOST_RE.fullmatch(u.netloc) or not re.fullmatch(r"/[A-Za-z0-9._-]+\.js", u.path) \
                or u.query or u.fragment:
            sys.exit(f"script-url must look like https://host/name.js (script at the site root): {script_url!r}")
        if domains and not re.fullmatch(r"[A-Za-z0-9.-]+(,[A-Za-z0-9.-]+)*", domains):
            sys.exit(f"bad --domains: {domains!r}")
        new = block(website_id, script_url, f"{u.scheme}://{u.netloc}", domains)

    changed, skipped, unchanged, nobody = [], 0, 0, []
    for p in sorted(root.rglob("*.html")):
        rel = p.relative_to(root)
        if ".git" in rel.parts or "tools" in rel.parts or rel.parts[0] == "demos":
            continue
        with open(p, encoding="utf-8", newline="") as f:
            s = f.read()
        if re.search(r'http-equiv=["\']?refresh', s, re.I):
            skipped += 1
            continue
        has = START in s
        if remove:
            s2 = BLOCK_RE.sub("", s) if has else s
        elif has:
            s2 = BLOCK_RE.sub(lambda m: new, s, count=1)
        elif "</body>" in s:
            s2 = s.replace("</body>", new + "</body>", 1)
        else:
            nobody.append(str(rel))
            continue
        if s2 == s:
            unchanged += 1
            continue
        changed.append(str(rel))
        if not dry:
            with open(p, "w", encoding="utf-8", newline="") as f:
                f.write(s2)

    for r in changed:
        print(("would change: " if dry else "changed: ") + r)
    for r in nobody:
        print("no </body>, left alone:", r)
    verb = "removed from" if remove else "updated"
    print(f"pages {verb}: {len(changed)}, already up to date: {unchanged}, "
          f"redirect pages skipped: {skipped}{' (dry run)' if dry else ''}")


if __name__ == "__main__":
    main()
