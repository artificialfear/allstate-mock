#!/usr/bin/env python3
"""Build index.html by inlining every <!--INLINE:path--> marker in src/index.template.html.
Run from the repo root:  python3 build.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent


def build():
    tpl = (ROOT / "src" / "index.template.html").read_text(encoding="utf-8")

    def sub(m):
        return (ROOT / m.group(1)).read_text(encoding="utf-8").rstrip() + "\n"

    out = re.sub(r"<!--INLINE:([^>]+)-->", sub, tpl)
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print(f"index.html written ({len(out):,} bytes)")


if __name__ == "__main__":
    build()
