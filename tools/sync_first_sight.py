#!/usr/bin/env python3
"""Copy First Sight's engine from a Band Arcade checkout into vendor/first-sight/.

Usage:  python3 tools/sync_first_sight.py /path/to/band-arcade
Then:   python3 build.py && python3 tests/smoke.py

Band Arcade (stemband/band-arcade) is the source of truth. These files are copied unchanged; the mock tool's own glue
lives in src/fs-shim.js and src/sight.js. vendor/first-sight/SOURCE.md records which Band Arcade commit was copied.
"""
import pathlib, shutil, subprocess, sys, datetime

FILES = {  # band-arcade path -> vendor name
    'shared/instruments.js': 'instruments.js',  # members, ranges, transpositions (GMEA sheets)
    'shared/scales.js': 'scales.js',            # written keys / starting notes
    'shared/counting.js': 'counting.js',        # rhythm parsing used by the generator
    'shared/ui.js': 'ui.js',                    # staff helpers: noteY, key signatures
    'shared/notation.js': 'notation.js',        # the engraver
    'first-sight/etudes.js': 'etudes.js',       # THE GENERATOR (levels, codes)
    'shared/winds.js': 'winds.js',              # Hear It voices
    'music-highway/backing.js': 'backing.js',   # click + snare
    'shared/fonts/music.woff2': 'music.woff2',  # Noto Music subset (SIL OFL)
}

src = pathlib.Path(sys.argv[1]).resolve()
dest = pathlib.Path(__file__).resolve().parent.parent / 'vendor' / 'first-sight'
dest.mkdir(parents=True, exist_ok=True)
for a, b in FILES.items():
    shutil.copyfile(src / a, dest / b)
    print('copied', a)
try:
    commit = subprocess.check_output(['git', '-C', str(src), 'log', '-1', '--format=%h %ad', '--date=short']).decode().strip()
except Exception:
    commit = 'unknown'
(dest / 'SOURCE.md').write_text(f"""# First Sight engine (vendored)

Copied unchanged from Band Arcade (github.com/stemband/band-arcade), commit {commit}, on {datetime.date.today()}.
Do not edit these files here. Fix them in Band Arcade, then run `python3 tools/sync_first_sight.py <band-arcade>`.

| File | From |
|---|---|
""" + ''.join(f'| {b} | {a} |\n' for a, b in FILES.items()) + """
music.woff2 is a subset of Noto Music, Copyright 2022 The Noto Project Authors, SIL Open Font License 1.1.
""")
print('wrote', dest / 'SOURCE.md')
