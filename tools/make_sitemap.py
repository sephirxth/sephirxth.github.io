#!/usr/bin/env python3
"""Write sitemap.xml at the site root, listing every real page of the site.

Usage: make_sitemap.py <site-root> [--dry-run]

  <site-root> must be the top of the git repo (lastmod comes from git, so a copy without .git
  will not do).

Which pages: every *.html outside .git, tools/, and standalone demos/, except redirect-only pages (meta refresh: the
old addresses), 404.html, and explicitly withdrawn project pages. x/index.html is listed as https://sephirxth.github.io/x/ ; other
files keep their name. Paths are percent-encoded as UTF-8 (Chinese titles, spaces, full-width
punctuation), sorted by path.

lastmod: the date of the last commit that touched the file (committer date, YYYY-MM-DD as the
commit records it). A file with uncommitted changes, or not committed yet, gets today's date, so
run this after the other tools/ scripts, then commit the pages and sitemap.xml together; running
it again after the commit gives the same file. The file is only rewritten when its content
changes. Line endings are \\n.
"""
import datetime, pathlib, re, subprocess, sys
from urllib.parse import quote
from xml.sax.saxutils import escape

BASE = "https://sephirxth.github.io"
EXCLUDE = {"404.html", "projects/cozy-apocalypse/index.html", "en/projects/cozy-apocalypse/index.html"}  # paths relative to the site root
REDIRECT_RE = re.compile(r'http-equiv=["\']?refresh', re.I)


def git(root, *args):
    r = subprocess.run(["git", "--literal-pathspecs", "-C", str(root), *args],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        sys.exit(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout


def changed_paths(root):
    """Paths (relative to the repo top) that differ from HEAD, staged or not, plus untracked ones."""
    diff = git(root, "diff", "--name-only", "-z", "HEAD")
    new = git(root, "ls-files", "--others", "--exclude-standard", "-z")
    return {p for p in (diff + new).split("\0") if p}


def page_path(rel: pathlib.PurePosixPath) -> str:
    """URL path without the leading slash, not encoded yet: 'a/b/' for a/b/index.html."""
    if rel.name == "index.html":
        d = rel.parent.as_posix()
        return "" if d == "." else d + "/"
    return rel.as_posix()


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry = "--dry-run" in sys.argv[1:]
    if len(args) != 1 or args[0].startswith("-"):
        sys.exit(__doc__)
    root = pathlib.Path(args[0]).resolve()
    if not root.is_dir():
        sys.exit(f"not a directory: {root}")
    top = pathlib.Path(git(root, "rev-parse", "--show-toplevel").strip()).resolve()
    if top != root:
        sys.exit(f"{root} is not the top of the git repo (that is {top})")

    changed = changed_paths(root)
    today = datetime.date.today().isoformat()
    pages, redirects, excluded = [], 0, []
    for p in sorted(root.rglob("*.html")):
        rel = pathlib.PurePosixPath(p.relative_to(root).as_posix())
        if ".git" in rel.parts or "tools" in rel.parts or rel.parts[0] == "demos":
            continue
        if rel.as_posix() in EXCLUDE:
            excluded.append(rel.as_posix())
            continue
        with open(p, encoding="utf-8", newline="") as f:
            if REDIRECT_RE.search(f.read()):
                redirects += 1
                continue
        if rel.as_posix() in changed:
            lastmod = today
        else:
            lastmod = git(root, "log", "-1", "--format=%cs", "--", rel.as_posix()).strip() or today
        pages.append((page_path(rel), lastmod))

    pages.sort()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, lastmod in pages:
        loc = BASE + "/" + quote(path, safe="/")
        lines += ["  <url>", f"    <loc>{escape(loc)}</loc>", f"    <lastmod>{lastmod}</lastmod>", "  </url>"]
    lines.append("</urlset>")
    xml = "\n".join(lines) + "\n"

    out = root / "sitemap.xml"
    old = out.read_text(encoding="utf-8") if out.exists() else None
    if dry:
        for path, lastmod in pages:
            print(lastmod, BASE + "/" + path)
    elif xml != old:
        with open(out, "w", encoding="utf-8", newline="") as f:
            f.write(xml)
    state = "unchanged" if xml == old else ("would change" if dry else "written")
    print(f"sitemap.xml {state}: {len(pages)} urls, redirect pages skipped: {redirects}, "
          f"excluded: {', '.join(excluded) or 'none'}{' (dry run)' if dry else ''}")


if __name__ == "__main__":
    main()
