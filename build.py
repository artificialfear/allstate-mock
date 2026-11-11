#!/usr/bin/env python3
"""Build index.html by inlining every <!--INLINE:path--> marker in src/index.template.html.
Run from the repo root:  python3 build.py
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent


def build():
    tpl = (ROOT / "src" / "index.template.html").read_text(encoding="utf-8")

    def sub(m):
        return (ROOT / m.group(1)).read_text(encoding="utf-8").rstrip() + "\n"

    out = re.sub(r"<!--INLINE:([^>]+)-->", sub, tpl)
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    # the service worker's VERSION = hash of the app + the files it caches, so any change re-caches on every device
    h = hashlib.sha256(out.encode("utf-8"))
    for f in ["manifest.webmanifest", "assets/sight-reading-instructions.mp3", "assets/oswald-latin-600-normal.woff2",
              "vendor/first-sight/music.woff2", "assets/icon-192.png", "assets/icon-512.png", "assets/apple-touch-icon.png"]:
        h.update((ROOT / f).read_bytes())
    ver = h.hexdigest()[:12]
    sw = (ROOT / "src" / "sw.js").read_text(encoding="utf-8").replace("__VERSION__", ver)
    (ROOT / "sw.js").write_text(sw, encoding="utf-8")
    print(f"index.html written ({len(out):,} bytes), sw.js version {ver}")


if __name__ == "__main__":
    build()
